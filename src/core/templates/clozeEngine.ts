export interface ClozeItem {
  index: number; // e.g. 1 for c1, 2 for c2
  answer: string;
  hint?: string;
  raw: string; // The full {{cN::answer::hint}} token
}

export class ClozeEngine {
  // Regex to match {{cN::answer}} or {{cN::answer::hint}}
  // c(\d+) captures the number, ([^:]+) or everything up to :: or }} captures answer, optional hint
  private static CLOZE_REGEX = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

  /**
   * Extracts all unique 1-based cloze indices present in the text.
   * Sorted in ascending numerical order.
   * Example: "Die {{c1::A}} ist {{c2::B}} und {{c1::C}}" -> [1, 2]
   */
  static extractClozeIndices(text: string): number[] {
    if (!text || typeof text !== 'string') return [];

    const indices = new Set<number>();
    const regex = new RegExp(this.CLOZE_REGEX.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const numStr = match[1];
      if (numStr) {
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > 0) {
          indices.add(num);
        }
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Parses all cloze occurrences from the text.
   */
  static parseClozes(text: string): ClozeItem[] {
    if (!text || typeof text !== 'string') return [];

    const items: ClozeItem[] = [];
    const regex = new RegExp(this.CLOZE_REGEX.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const num = parseInt(match[1] || '0', 10);
      const answer = match[2] ?? '';
      const hint = match[3] !== undefined ? match[3] : undefined;

      items.push({
        index: num,
        answer,
        hint,
        raw: match[0],
      });
    }

    return items;
  }

  /**
   * Renders the question view for a specific target cloze index.
   * - Instances of the target cloze are replaced with [hint] or [...] wrapped in a styled span.
   * - Instances of other cloze numbers show their plain answer text.
   *
   * @param text The raw field text containing cloze markers.
   * @param targetIndex The 1-based cloze index to test (e.g. 1 for c1).
   */
  static renderQuestion(text: string, targetIndex: number): string {
    if (!text || typeof text !== 'string') return '';

    return text.replace(new RegExp(this.CLOZE_REGEX.source, 'g'), (_match, numStr, answer, hint) => {
      const num = parseInt(numStr, 10);
      if (num === targetIndex) {
        const placeholder = hint !== undefined && hint.trim().length > 0 ? `[${hint}]` : '[...]';
        return `<span class="cloze-prompt">${placeholder}</span>`;
      }
      // Non-target cloze numbers remain visible as plain text
      return answer;
    });
  }

  /**
   * Renders the answer view for a specific target cloze index.
   * - Instances of the target cloze are highlighted with <span class="cloze">answer</span>.
   * - Instances of other cloze numbers show their plain answer text.
   *
   * @param text The raw field text containing cloze markers.
   * @param targetIndex The 1-based cloze index that was tested.
   */
  static renderAnswer(text: string, targetIndex: number): string {
    if (!text || typeof text !== 'string') return '';

    return text.replace(new RegExp(this.CLOZE_REGEX.source, 'g'), (_match, numStr, answer) => {
      const num = parseInt(numStr, 10);
      if (num === targetIndex) {
        return `<span class="cloze">${answer}</span>`;
      }
      return answer;
    });
  }

  /**
   * Strips all cloze syntax completely, leaving only clean answer texts.
   */
  static stripClozes(text: string): string {
    if (!text || typeof text !== 'string') return '';

    return text.replace(new RegExp(this.CLOZE_REGEX.source, 'g'), (_match, _numStr, answer) => {
      return answer;
    });
  }
}
