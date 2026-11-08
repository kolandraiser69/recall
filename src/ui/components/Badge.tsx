import React from 'react';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral:
    'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]',
  accent:
    'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-subtle)]',
  success:
    'bg-[var(--success-subtle)] text-[var(--success)] border border-[var(--success-subtle)]',
  warning:
    'bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning-subtle)]',
  danger:
    'bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger-subtle)]',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
  md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
  icon,
}) => {
  return (
    <span
      className={`
        inline-flex items-center rounded-full select-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
