import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
  id,
}) => {
  const generatedId = React.useId();
  const toggleId = id || generatedId;

  return (
    <div className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}>
      {(label || description) && (
        <label htmlFor={toggleId} className="cursor-pointer text-left select-none">
          {label && <span className="block text-sm font-medium text-[var(--text-primary)]">{label}</span>}
          {description && <span className="block text-xs text-[var(--text-tertiary)]">{description}</span>}
        </label>
      )}

      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5
          transition-colors duration-200 ease-in-out outline-none
          focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
          focus-visible:ring-offset-[var(--bg-app)]
          ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-muted)]'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs
            transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
};
