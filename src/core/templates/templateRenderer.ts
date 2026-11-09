import { ClozeEngine } from './clozeEngine';
import type { CardTemplate } from '../models/noteType';

export interface RenderResult {
  questionHtml: string;
  answerHtml: string;
}

export interface RenderOptions {
  clozeIndex?: number; // 1-based index (e.g. 1 for c1)
  resolveMediaUrl?: (filename: string) => string | null;
}

export class TemplateRenderer {
  /**
   * Renders a given template with field values.
   *
   * @param template The CardTemplate containing qfmt and afmt.
   * @param fieldValues Map of field names to string/HTML values.
   * @param options Optional parameters (e.g. clozeIndex for cloze notes, media resolver).
   */
  static render(
    template: CardTemplate,
    fieldValues: Record<string, string>,
    options?: RenderOptions
  ): RenderResult {
    const clozeIndex = options?.clozeIndex ?? 1;

    // 1. Render Question side
    const rawQuestionHtml = this.renderSide(template.qfmt, fieldValues, {
      isQuestion: true,
      clozeIndex,
    });

    const questionHtml = this.postProcess(rawQuestionHtml, options?.resolveMediaUrl);

    // 2. Render Answer side, providing {{FrontSide}} as the rendered question
    const rawAnswerHtml = this.renderSide(template.afmt, fieldValues, {
      isQuestion: false,
      clozeIndex,
      frontSide: questionHtml,
    });

    const answerHtml = this.postProcess(rawAnswerHtml, options?.resolveMediaUrl);

    return {
      questionHtml,
      answerHtml,
    };
  }

  /**
   * Evaluates Mustache-like field replacements:
   * - {{Field}}
   * - {{cloze:Field}}
   * - {{text:Field}}
   * - {{hint:Field}}
   * - {{type:Field}}
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

    // 5. Replace {{text:FieldName}} tags (strip HTML tags)
    result = result.replace(/\{\{text:([a-zA-Z0-9_\-\s]+)\}\}/g, (_match, fieldName) => {
      const trimmed = fieldName.trim();
      const rawText = fieldValues[trimmed] ?? '';
      return rawText.replace(/<[^>]*>/g, '').trim();
    });

    // 6. Replace {{hint:FieldName}} tags (collapsible disclosure)
    result = result.replace(/\{\{hint:([a-zA-Z0-9_\-\s]+)\}\}/g, (_match, fieldName) => {
      const trimmed = fieldName.trim();
      const rawText = fieldValues[trimmed] ?? '';
      if (!rawText.trim()) return '';
      return `<details class="anki-hint"><summary class="anki-hint-summary cursor-pointer text-xs text-[var(--accent)] font-medium">Show Hint</summary><div class="anki-hint-body mt-1 text-xs opacity-80">${rawText}</div></details>`;
    });

    // 7. Replace {{type:FieldName}} tags
    result = result.replace(/\{\{type:([a-zA-Z0-9_\-\s]+)\}\}/g, (_match, fieldName) => {
      const trimmed = fieldName.trim();
      const rawText = fieldValues[trimmed] ?? '';
      if (context.isQuestion) {
        return `<div class="anki-type-prompt">[Type Answer]</div>`;
      }
      return `<div class="anki-type-answer">${rawText}</div>`;
    });

    // 8. Replace standard {{FieldName}} tags
    result = result.replace(/\{\{([a-zA-Z0-9_\-\s]+)\}\}/g, (_match, fieldName) => {
      const trimmed = fieldName.trim();
      return fieldValues[trimmed] ?? '';
    });

    return result.trim();
  }

  /**
   * Post-processes HTML:
   * - Converts [sound:filename] into <audio> tags
   * - Disarms and sanitizes unsafe scripts and inline event handlers
   * - Resolves relative media URLs using the optional resolver
   */
  private static postProcess(html: string, resolveMediaUrl?: (filename: string) => string | null): string {
    if (!html) return '';

    let processed = html;

    // 1. Convert [sound:filename.ext] to audio player
    processed = processed.replace(/\[sound:([^\]]+)\]/gi, (_match, filename) => {
      const trimmed = filename.trim();
      const url = resolveMediaUrl ? (resolveMediaUrl(trimmed) ?? trimmed) : trimmed;
      return `<audio controls src="${url}" preload="metadata" class="anki-audio my-2 max-w-full"></audio>`;
    });

    // 2. Resolve <img src="..."> if media resolver provided
    if (resolveMediaUrl) {
      processed = processed.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi, (match, prefix, src, suffix) => {
        // Only resolve relative media filenames (not data: or http://)
        if (!src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('blob:')) {
          const resolved = resolveMediaUrl(src);
          if (resolved) {
            return `<img ${prefix}src="${resolved}"${suffix}>`;
          }
        }
        return match;
      });
    }

    // 3. Security: Sanitize <script> tags to prevent arbitrary execution in application
    processed = processed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, () => {
      return `<span class="anki-disabled-script text-[11px] text-[var(--text-tertiary)] italic" title="Custom script disabled for security">[Script Disabled]</span>`;
    });

    // 4. Security: Strip inline event handlers (onerror=, onload=, onclick=, etc.)
    processed = processed.replace(/\son[a-zA-Z]+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '');

    // 5. Security: Disarm javascript: pseudo-protocol in links
    processed = processed.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');

    return processed;
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
