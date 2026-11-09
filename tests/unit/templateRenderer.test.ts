import { describe, it, expect } from 'vitest';
import { TemplateRenderer } from '../../src/core/templates/templateRenderer';
import type { CardTemplate } from '../../src/core/models/noteType';

describe('TemplateRenderer', () => {
  const basicTemplate: CardTemplate = {
    name: 'Card 1',
    qfmt: '{{Front}}',
    afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
  };

  it('should render standard front and back fields', () => {
    const fields = {
      Front: 'What is photosynthesis?',
      Back: 'Process used by plants to convert light into energy.',
    };

    const result = TemplateRenderer.render(basicTemplate, fields);

    expect(result.questionHtml).toBe('What is photosynthesis?');
    expect(result.answerHtml).toContain('What is photosynthesis?');
    expect(result.answerHtml).toContain('<hr id="answer">');
    expect(result.answerHtml).toContain('Process used by plants to convert light into energy.');
  });

  it('should render custom fields dynamically', () => {
    const customTemplate: CardTemplate = {
      name: 'Vocab',
      qfmt: '<span class="word">{{Word}}</span> ({{PartOfSpeech}})',
      afmt: '{{FrontSide}}<br>{{Translation}}<br><em>{{Example}}</em>',
    };

    const fields = {
      Word: 'luminous',
      PartOfSpeech: 'adj.',
      Translation: 'leuchtend',
      Example: 'The luminous dial of his watch.',
    };

    const result = TemplateRenderer.render(customTemplate, fields);

    expect(result.questionHtml).toBe('<span class="word">luminous</span> (adj.)');
    expect(result.answerHtml).toContain('leuchtend');
    expect(result.answerHtml).toContain('<em>The luminous dial of his watch.</em>');
  });

  it('should gracefully handle unknown or missing fields without throwing', () => {
    const templateWithUnknown: CardTemplate = {
      name: 'Test',
      qfmt: '{{NonExistentField}} and {{Front}}',
      afmt: '{{Back}}',
    };

    const fields = {
      Front: 'Known',
      Back: 'Answer',
    };

    const result = TemplateRenderer.render(templateWithUnknown, fields);
    expect(result.questionHtml).toBe('and Known');
    expect(result.answerHtml).toBe('Answer');
  });

  it('should handle positive conditional fields {{#Field}}...{{/Field}}', () => {
    const templateWithCondition: CardTemplate = {
      name: 'Conditional',
      qfmt: '{{Word}}{{#Hint}} (Hint: {{Hint}}){{/Hint}}',
      afmt: '{{Meaning}}',
    };

    // When hint is present
    const withHint = TemplateRenderer.render(templateWithCondition, {
      Word: 'Apple',
      Hint: 'Fruit',
      Meaning: 'Apfel',
    });
    expect(withHint.questionHtml).toBe('Apple (Hint: Fruit)');

    // When hint is empty or undefined
    const withoutHint = TemplateRenderer.render(templateWithCondition, {
      Word: 'Apple',
      Meaning: 'Apfel',
    });
    expect(withoutHint.questionHtml).toBe('Apple');
  });

  it('should handle inverted conditional fields {{^Field}}...{{/Field}}', () => {
    const templateWithInverted: CardTemplate = {
      name: 'Inverted',
      qfmt: '{{Word}}{{^Audio}} [No audio available]{{/Audio}}',
      afmt: '{{Meaning}}',
    };

    // Without audio
    const withoutAudio = TemplateRenderer.render(templateWithInverted, {
      Word: 'Hello',
      Meaning: 'Hallo',
    });
    expect(withoutAudio.questionHtml).toBe('Hello [No audio available]');

    // With audio
    const withAudio = TemplateRenderer.render(templateWithInverted, {
      Word: 'Hello',
      Audio: 'sound.mp3',
      Meaning: 'Hallo',
    });
    expect(withAudio.questionHtml).toBe('Hello');
  });

  it('should identify empty questions correctly with isQuestionEmpty', () => {
    const template: CardTemplate = {
      name: 'Card 1',
      qfmt: '{{Front}}',
      afmt: '{{Back}}',
    };

    expect(TemplateRenderer.isQuestionEmpty(template, { Front: '  ', Back: 'Data' })).toBe(true);
    expect(TemplateRenderer.isQuestionEmpty(template, { Front: '<span></span>', Back: 'Data' })).toBe(true);
    expect(TemplateRenderer.isQuestionEmpty(template, { Front: 'Valid Question', Back: 'Data' })).toBe(false);
  });

  it('should support Anki {{text:Field}} tag to strip HTML tags', () => {
    const template: CardTemplate = {
      name: 'Text Tag',
      qfmt: '{{text:Formatted}}',
      afmt: '{{Formatted}}',
    };

    const res = TemplateRenderer.render(template, {
      Formatted: '<b>Bold</b> and <i>Italic</i>',
    });

    expect(res.questionHtml).toBe('Bold and Italic');
    expect(res.answerHtml).toBe('<b>Bold</b> and <i>Italic</i>');
  });

  it('should support Anki {{hint:Field}} collapsible disclosure', () => {
    const template: CardTemplate = {
      name: 'Hint Tag',
      qfmt: '{{Question}}<br>{{hint:Clue}}',
      afmt: '{{Answer}}',
    };

    const res = TemplateRenderer.render(template, {
      Question: 'Capital of Japan?',
      Clue: 'Starts with T',
      Answer: 'Tokyo',
    });

    expect(res.questionHtml).toContain('<details class="anki-hint">');
    expect(res.questionHtml).toContain('Show Hint');
    expect(res.questionHtml).toContain('Starts with T');
  });

  it('should convert [sound:filename] into audio player element', () => {
    const template: CardTemplate = {
      name: 'Audio Tag',
      qfmt: 'Listen: [sound:pronounce.mp3]',
      afmt: '{{Back}}',
    };

    const res = TemplateRenderer.render(template, { Back: 'Word' });
    expect(res.questionHtml).toContain('<audio controls src="pronounce.mp3"');
  });

  it('should sanitize script tags and inline event handlers for security', () => {
    const template: CardTemplate = {
      name: 'Malicious Card',
      qfmt: '<script>alert("hacked")</script><img src="x" onerror="evil()" />Hello',
      afmt: '<a href="javascript:steal()">Click</a>',
    };

    const res = TemplateRenderer.render(template, {});
    expect(res.questionHtml).not.toContain('<script>');
    expect(res.questionHtml).toContain('[Script Disabled]');
    expect(res.questionHtml).not.toContain('onerror=');
    expect(res.answerHtml).not.toContain('javascript:steal()');
    expect(res.answerHtml).toContain('href="#"');
  });
});
