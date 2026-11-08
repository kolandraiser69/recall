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
});
