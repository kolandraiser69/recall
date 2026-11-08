import { describe, it, expect } from 'vitest';
import { ClozeEngine } from '../../src/core/templates/clozeEngine';

describe('ClozeEngine', () => {
  it('should extract unique cloze indices in sorted numerical order', () => {
    const text = 'Die Hauptstadt von {{c2::Spanien}} ist {{c1::Madrid}} und nicht {{c2::Barcelona}}.';
    const indices = ClozeEngine.extractClozeIndices(text);
    expect(indices).toEqual([1, 2]);
  });

  it('should handle repeated cloze indices on the same card', () => {
    const text = 'Canberra is the capital of {{c1::Australia}} located in {{c1::ACT}}.';
    const indices = ClozeEngine.extractClozeIndices(text);
    expect(indices).toEqual([1]);
  });

  it('should parse cloze items with optional hints', () => {
    const text = '{{c1::Berlin::Capital}} is in {{c2::Germany}}';
    const items = ClozeEngine.parseClozes(text);

    expect(items.length).toBe(2);
    expect(items[0]).toEqual({
      index: 1,
      answer: 'Berlin',
      hint: 'Capital',
      raw: '{{c1::Berlin::Capital}}',
    });
    expect(items[1]).toEqual({
      index: 2,
      answer: 'Germany',
      hint: undefined,
      raw: '{{c2::Germany}}',
    });
  });

  it('should render question view hiding target cloze and revealing others', () => {
    const text = 'Die Hauptstadt von {{c1::Japan}} ist {{c2::Tokio::Metropole}}.';

    // Card 1 question: c1 hidden, c2 plain text
    const q1 = ClozeEngine.renderQuestion(text, 1);
    expect(q1).toBe('Die Hauptstadt von <span class="cloze-prompt">[...]</span> ist Tokio.');

    // Card 2 question: c1 plain text, c2 hidden with hint
    const q2 = ClozeEngine.renderQuestion(text, 2);
    expect(q2).toBe('Die Hauptstadt von Japan ist <span class="cloze-prompt">[Metropole]</span>.');
  });

  it('should render answer view highlighting target cloze and displaying others', () => {
    const text = 'Die Hauptstadt von {{c1::Japan}} ist {{c2::Tokio::Metropole}}.';

    // Card 1 answer: c1 highlighted, c2 plain text
    const a1 = ClozeEngine.renderAnswer(text, 1);
    expect(a1).toBe('Die Hauptstadt von <span class="cloze">Japan</span> ist Tokio.');

    // Card 2 answer: c1 plain text, c2 highlighted
    const a2 = ClozeEngine.renderAnswer(text, 2);
    expect(a2).toBe('Die Hauptstadt von Japan ist <span class="cloze">Tokio</span>.');
  });

  it('should strip all cloze syntax completely', () => {
    const text = 'The {{c1::quick}} brown {{c2::fox::animal}} jumps.';
    expect(ClozeEngine.stripClozes(text)).toBe('The quick brown fox jumps.');
  });

  it('should gracefully handle empty or malformed input', () => {
    expect(ClozeEngine.extractClozeIndices('')).toEqual([]);
    expect(ClozeEngine.extractClozeIndices('Plain text without clozes')).toEqual([]);
    expect(ClozeEngine.extractClozeIndices('Malformed {{cx::broken}} and {{c0::invalid}}')).toEqual([]);
  });
});
