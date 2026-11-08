import React from 'react';

export interface SectionContainerProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SectionContainer: React.FC<SectionContainerProps> = ({
  title,
  description,
  action,
  children,
  className = '',
}) => {
  return (
    <section className={`space-y-3.5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-0.5">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-[var(--text-secondary)] uppercase">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
};
