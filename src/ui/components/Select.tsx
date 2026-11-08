import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className = '', id, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={`
              w-full h-10 appearance-none rounded-[var(--radius-md)] bg-[var(--bg-surface)] text-[var(--text-primary)]
              border border-[var(--border-subtle)] text-sm px-3.5 pr-10
              transition-all duration-150 outline-none cursor-pointer
              focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-subtle)]
              disabled:opacity-45 disabled:bg-[var(--bg-subtle)] disabled:cursor-not-allowed
              ${error ? 'border-[var(--danger)]' : ''}
              ${className}
            `}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
