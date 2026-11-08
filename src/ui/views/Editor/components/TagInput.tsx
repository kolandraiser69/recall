import React, { useState } from 'react';
import { X, Tag as TagIcon, Plus } from 'lucide-react';

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  availableSuggestions?: string[];
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  availableSuggestions = [],
}) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (rawText: string) => {
    const trimmed = rawText.trim().replace(/^#/, '');
    if (!trimmed) return;

    if (!tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      e.preventDefault();
      const lastTag = tags[tags.length - 1];
      if (lastTag) {
        removeTag(lastTag);
      }
    }
  };

  // Filter unused suggestions matching current input
  const suggestions = availableSuggestions
    .filter(
      (s) =>
        !tags.some((t) => t.toLowerCase() === s.toLowerCase()) &&
        (inputValue ? s.toLowerCase().includes(inputValue.toLowerCase()) : true)
    )
    .slice(0, 8);

  return (
    <div className="space-y-1.5 text-left">
      <label className="block text-xs font-medium text-[var(--text-secondary)]">
        Tags
      </label>

      {/* Main Container */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-subtle)] transition-all min-h-[42px]">
        <TagIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] ml-1 shrink-0" />

        {/* Existing Tag Chips */}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] animate-in zoom-in-95 duration-100"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="w-3.5 h-3.5 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors cursor-pointer rounded-full"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {/* Input */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) {
              addTag(inputValue);
            }
          }}
          placeholder={tags.length === 0 ? 'Type tag and press Enter...' : 'Add tag...'}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none px-1"
        />
      </div>

      {/* Suggestions Pills */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <span className="text-[10px] text-[var(--text-tertiary)] mr-1">Suggested:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addTag(suggestion)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
