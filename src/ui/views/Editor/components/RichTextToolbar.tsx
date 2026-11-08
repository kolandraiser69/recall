import React from 'react';
import { Bold, Italic, List, Link, Code, Brackets } from 'lucide-react';

export interface RichTextToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (newValue: string) => void;
  isCloze?: boolean;
}

export const RichTextToolbar: React.FC<RichTextToolbarProps> = ({
  textareaRef,
  value,
  onChange,
  isCloze = false,
}) => {
  const applyWrap = (prefix: string, suffix: string, defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end) || defaultText;

    const replacement = `${prefix}${selected}${suffix}`;
    const nextValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(nextValue);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = selected ? start + replacement.length : start + prefix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleCloze = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Detect highest cloze index in the text
    const matches = Array.from(value.matchAll(/\{\{c(\d+)::/g));
    const indices = matches.map((m) => parseInt(m[1] ?? '1', 10));
    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;

    applyWrap(`{{c${nextIndex}::`, '}}', '...');
  };

  const handleLink = () => {
    const url = window.prompt('Enter URL:');
    if (!url) return;
    applyWrap(`<a href="${url}">`, '</a>');
  };

  return (
    <div className="flex items-center gap-1 p-1 rounded-t-[var(--radius-md)] bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] select-none">
      <button
        type="button"
        title="Bold (<b>)"
        onClick={() => applyWrap('<b>', '</b>')}
        className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        title="Italic (<i>)"
        onClick={() => applyWrap('<i>', '</i>')}
        className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        title="Bullet List (<ul><li>)"
        onClick={() => applyWrap('<ul>\n  <li>', '</li>\n</ul>')}
        className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
      >
        <List className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        title="Code (<code>)"
        onClick={() => applyWrap('<code>', '</code>')}
        className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
      >
        <Code className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        title="Link (<a>)"
        onClick={handleLink}
        className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
      >
        <Link className="w-3.5 h-3.5" />
      </button>

      {isCloze && (
        <>
          <div className="w-[1px] h-4 bg-[var(--border-subtle)] mx-1" />
          <button
            type="button"
            title="Cloze Deletion ({{c1::...}})"
            onClick={handleCloze}
            className="flex items-center gap-1 px-2 h-7 rounded-[var(--radius-sm)] text-xs font-semibold text-[var(--accent)] bg-[var(--accent-subtle)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] transition-colors cursor-pointer"
          >
            <Brackets className="w-3.5 h-3.5" />
            <span>Cloze</span>
          </button>
        </>
      )}
    </div>
  );
};
