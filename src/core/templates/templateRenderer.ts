import { ClozeEngine } from './clozeEngine';
import type { CardTemplate } from '../models/noteType';

export interface RenderResult {
  questionHtml: string;
  answerHtml: string;
}

export class TemplateRenderer {
  /**
   * Renders a given template with field values.
   *
   * @param template The CardTemplate containing qfmt and afmt.
   * @param fieldValues Map of field names to string/HTML values.
   * @param options Optional parameters (e.g. clozeIndex for cloze notes).
   */
  static render(
    template: CardTemplate,
    fieldValues: Record<string, string>,
    options?: {
      clozeIndex?: number; // 1-based index (e.g. 1 for c1)
    }
  ): RenderResult {
    const clozeIndex = options?.clozeIndex ?? 1;

    // 1. Render Question side
    const questionHtml = this.renderSide(template.qfmt, fieldValues, {
      isQuestion: true,
      clozeIndex,
    });

    // 2. Render Answer side, providing {{FrontSide}} as the rendered question
    const answerHtml = this.renderSide(template.afmt, fieldValues, {
      isQuestion: false,
      clozeIndex,
      frontSide: questionHtml,
    });

    return {
      questionHtml,
      answerHtml,
    };
  }

  /**
   * Evaluates Mustache-like field replacements:
   * - {{Field}}
   * - {{cloze:Field}}
   * - {{FrontSide}}
   * - Conditional blocks: {{#Field}}...{{/Field}} and {{^Field}}...{{/Field}}
   */
  private static renderSide(
    templateFormat: string,
    fieldValues: Record<string, string>,
    context: {
      isQuestion: boolean;
      clozeIndex: number;
      frontSide?: string;
    }
  ): string {
    if (!templateFormat || typeof templateFormat !== 'string') {
      return '';
    }

    let result = templateFormat;

    // 1. Evaluate positive conditional sections: {{#FieldName}}content{{/FieldName}}
    result = result.replace(/\{\{#([a-zA-Z0-9_\-\s]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, fieldName, inner) => {
      const trimmed = fieldName.trim();
      const val = fieldValues[trimmed];
      const hasContent = val !== undefined && val !== null && val.trim().length > 0;
      return hasContent ? inner : '';
    });

    // 2. Evaluate inverted conditional sections: {{^FieldName}}content{{/FieldName}}
    result = result.replace(/\{\{\^([a-zA-Z0-9_\-\s]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, fieldName, inner) => {
      const trimmed = fieldName.trim();
      const val = fieldValues[trimmed];
      const isEmpty = val === undefined || val === null || val.trim().length === 0;
      return isEmpty ? inner : '';
    });

    // 3. Replace {{FrontSide}} if available in answer context
    result = result.replace(/\{\{FrontSide\}\}/gi, () => {
      return context.frontSide ?? '';
    });

    // 4. Replace {{cloze:FieldName}} tags
    result = result.replace(/\{\{cloze:([a-zA-Z0-9_\-\s]+)\}\}/g, (_match, fieldName) => {
      const trimmed = fieldName.trim();
      const rawText = fieldValues[trimmed] ?? '';
      if (context.isQuestion) {
        return ClozeEngine.renderQuestion(rawText, context.clozeIndex);
      }
      return ClozeEngine.renderAnswer(rawText, context.clozeIndex);
    });

    // 5. Replace standard {{FieldName}} tags
    result = result.replace(/\{\{([a-zA-Z0-9_\-\s]+)\}\}/g, (_match, fieldName) => {
      const trimmed = fieldName.trim();
      // If the field exists in fieldValues, return it; otherwise empty string without crash
      return fieldValues[trimmed] ?? '';
    });

    return result.trim();
  }

  /**
   * Checks whether a template generates empty/blank question content for the given fields.
   */
  static isQuestionEmpty(
    template: CardTemplate,
    fieldValues: Record<string, string>,
    clozeIndex = 1
  ): boolean {
    const rendered = this.renderSide(template.qfmt, fieldValues, {
      isQuestion: true,
      clozeIndex,
    });
    // Strip HTML tags and whitespace
    const textOnly = rendered.replace(/<[^>]*>/g, '').trim();
    return textOnly.length === 0;
  }
}
