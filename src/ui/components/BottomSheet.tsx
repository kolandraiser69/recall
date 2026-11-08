import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        ref={sheetRef}
        className="
          relative w-full max-h-[85dvh] rounded-t-[var(--radius-xl)] bg-[var(--bg-surface-elevated)]
          border-t border-[var(--border-strong)] shadow-[var(--shadow-overlay)]
          flex flex-col safe-bottom animate-in slide-in-from-bottom duration-250 ease-out
        "
      >
        {/* Grab Handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--bg-muted)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--divider)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          <IconButton size="sm" aria-label="Close sheet" onClick={onClose}>
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};
