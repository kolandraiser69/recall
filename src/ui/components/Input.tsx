import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className = '', id, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[var(--text-tertiary)]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={`
              w-full h-10 rounded-[var(--radius-md)] bg-[var(--bg-surface)] text-[var(--text-primary)]
              border border-[var(--border-subtle)] text-sm px-3.5
              transition-all duration-150 outline-none
              placeholder:text-[var(--text-quaternary)]
              focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-subtle)]
              disabled:opacity-45 disabled:bg-[var(--bg-subtle)] disabled:cursor-not-allowed
              ${leftIcon ? 'pl-9' : ''}
              ${rightIcon ? 'pr-9' : ''}
              ${error ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger-subtle)]' : ''}
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-[var(--text-tertiary)]">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-[var(--danger)] mt-1">{error}</p>
        ) : hint ? (
          <p className="text-xs text-[var(--text-tertiary)] mt-1">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
