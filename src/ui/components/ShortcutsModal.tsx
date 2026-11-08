import React from 'react';
import { Modal } from './Modal';
import { useKeyboardShortcuts, GLOBAL_SHORTCUTS } from '../keyboard/KeyboardShortcutsProvider';

export const ShortcutsModal: React.FC = () => {
  const { isHelpOpen, setIsHelpOpen } = useKeyboardShortcuts();

  return (
    <Modal
      isOpen={isHelpOpen}
      onClose={() => setIsHelpOpen(false)}
      title="Keyboard Shortcuts"
      description="Navigate Recall efficiently without leaving your keyboard"
      maxWidth="md"
    >
      <div className="space-y-4 pt-1">
        <div className="space-y-2">
          {GLOBAL_SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between py-1.5 px-2 rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)]"
            >
              <span className="text-xs text-[var(--text-secondary)]">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((k) => (
                  <kbd
                    key={k}
                    className="
                      min-w-[22px] h-[22px] px-1.5 flex items-center justify-center
                      text-[11px] font-mono font-medium rounded-[5px]
                      bg-[var(--bg-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]
                    "
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-[var(--divider)] text-center">
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Press <kbd className="px-1 py-0.5 font-mono text-[10px] bg-[var(--bg-muted)] rounded">?</kbd> anywhere to toggle this help
          </p>
        </div>
      </div>
    </Modal>
  );
};
