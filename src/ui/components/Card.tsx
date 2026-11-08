import React from 'react';

export type CardVariant = 'standard' | 'interactive' | 'elevated' | 'subtle';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?: React.ElementType;
}

const variantStyles: Record<CardVariant, string> = {
  standard:
    'bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-subtle)]',
  interactive:
    'bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] cursor-pointer active:scale-[0.99] transition-all duration-150',
  elevated:
    'bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] shadow-[var(--shadow-overlay)]',
  subtle:
    'bg-[var(--bg-subtle)] border border-transparent',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

export const Card: React.FC<CardProps> = ({
  variant = 'standard',
  padding = 'md',
  as: Component = 'div',
  className = '',
  children,
  ...props
}) => {
  return (
    <Component
      className={`
        rounded-[var(--radius-lg)]
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </Component>
  );
};
