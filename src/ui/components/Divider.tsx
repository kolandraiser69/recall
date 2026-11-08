import React from 'react';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  label?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  className = '',
  label,
}) => {
  if (orientation === 'vertical') {
    return <div className={`w-[1px] h-full bg-[var(--divider)] shrink-0 ${className}`} />;
  }

  if (label) {
    return (
      <div className={`flex items-center gap-3 my-4 ${className}`}>
        <div className="flex-1 h-[1px] bg-[var(--divider)]" />
        <span className="text-xs uppercase tracking-wider text-[var(--text-tertiary)] font-medium">
          {label}
        </span>
        <div className="flex-1 h-[1px] bg-[var(--divider)]" />
      </div>
    );
  }

  return <div className={`w-full h-[1px] bg-[var(--divider)] my-3 ${className}`} />;
};
