import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onClear, className = '', placeholder = 'Search...', onChange, ...props }, ref) => {
    const hasValue = Boolean(value && String(value).length > 0);

    return (
      <div className={`relative flex items-center w-full ${className}`}>
        <Search className="absolute left-3 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="
            w-full h-9 pl-9 pr-8 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-primary)]
            border border-[var(--border-subtle)] text-sm
            transition-all duration-150 outline-none
            placeholder:text-[var(--text-quaternary)]
            focus:bg-[var(--bg-surface)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-subtle)]
          "
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-2.5 p-0.5 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
