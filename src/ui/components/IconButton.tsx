import React from 'react';
import type { ButtonVariant, ButtonSize } from './Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  'aria-label': string; // Strikte Barrierefreiheit
  children: React.ReactNode;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'w-8 h-8 rounded-[var(--radius-sm)]',
  md: 'w-10 h-10 rounded-[var(--radius-md)] min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0', // 44px touch target on mobile
  lg: 'w-12 h-12 rounded-[var(--radius-md)]',
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]',
  secondary:
    'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:bg-[var(--bg-muted)]',
  destructive:
    'bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)]',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'ghost', size = 'md', children, className = '', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center shrink-0 select-none
          transition-all duration-150 ease-out outline-none
          focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
          focus-visible:ring-offset-[var(--bg-app)]
          disabled:opacity-45 disabled:pointer-events-none
          cursor-pointer active:scale-95
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
