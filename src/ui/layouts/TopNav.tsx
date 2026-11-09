import React from 'react';
import { Settings, Command } from 'lucide-react';
import { useNavigation, type NavRoute } from '../navigation/NavigationContext';
import { useKeyboardShortcuts } from '../keyboard/KeyboardShortcutsProvider';
import { IconButton } from '../components/IconButton';

export const TopNav: React.FC = () => {
  const { currentRoute, navigateTo } = useNavigation();
  const { toggleHelp } = useKeyboardShortcuts();

  const titleMap: Record<NavRoute, string> = {
    home: 'Home',
    study: 'Study',
    decks: 'Decks',
    collection: 'Collection',
    statistics: 'Statistics',
    calendar: 'Kalender',
    quicklinks: 'Uni-Quicklinks',
    settings: 'Settings',
  };

  return (
    <header className="h-14 px-4 md:px-8 border-b border-[var(--divider)] flex items-center justify-between sticky top-0 bg-[var(--bg-app)]/80 backdrop-blur-md z-20 select-none">
      <div className="flex items-center gap-3">
        {/* Mobile App Brand */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-6 h-6 rounded-[6px] bg-[var(--accent)] flex items-center justify-center text-white">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-[var(--text-primary)]">Recall</span>
          <span className="text-xs text-[var(--text-tertiary)]">/</span>
        </div>

        <h1 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
          {titleMap[currentRoute]}
        </h1>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Keyboard shortcut trigger */}
        <button
          type="button"
          onClick={toggleHelp}
          aria-label="Show keyboard shortcuts"
          className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-[11px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors border border-[var(--border-subtle)]"
          title="Press '?' for keyboard shortcuts"
        >
          <Command className="w-3 h-3" />
          <span>Shortcuts</span>
          <kbd className="text-[10px] bg-[var(--bg-muted)] px-1 rounded">?</kbd>
        </button>

        {/* Mobile Settings Shortcut */}
        <div className="md:hidden">
          <IconButton
            size="sm"
            aria-label="Open settings"
            onClick={() => navigateTo('settings')}
            className={currentRoute === 'settings' ? 'text-[var(--accent)]' : ''}
          >
            <Settings className="w-4 h-4" />
          </IconButton>
        </div>
      </div>
    </header>
  );
};
