import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigation, type NavRoute } from '../navigation/NavigationContext';

interface ShortcutDefinition {
  keys: string[];
  description: string;
  category: 'Navigation' | 'General';
}

export const GLOBAL_SHORTCUTS: ShortcutDefinition[] = [
  { keys: ['g', 'h'], description: 'Go to Home', category: 'Navigation' },
  { keys: ['g', 's'], description: 'Go to Study', category: 'Navigation' },
  { keys: ['g', 'd'], description: 'Go to Decks', category: 'Navigation' },
  { keys: ['g', 'c'], description: 'Go to Collection', category: 'Navigation' },
  { keys: ['g', 't'], description: 'Go to Statistics', category: 'Navigation' },
  { keys: ['g', ','], description: 'Go to Settings', category: 'Navigation' },
  { keys: ['?'], description: 'Show Keyboard Shortcuts', category: 'General' },
  { keys: ['Esc'], description: 'Close Dialogs & Overlays', category: 'General' },
];

interface KeyboardShortcutsContextValue {
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  toggleHelp: () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | undefined>(undefined);

export const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { navigateTo } = useNavigation();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [lastLeaderKey, setLastLeaderKey] = useState<string | null>(null);

  useEffect(() => {
    let chordTimeout: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Guard: Ignore if user is currently typing in an input field (check both activeElement and event target)
      const activeEl = document.activeElement as HTMLElement | null;
      const targetEl = e.target as HTMLElement | null;

      const isInput = (el: HTMLElement | null) =>
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable);

      if (isInput(activeEl) || isInput(targetEl)) {
        return;
      }

      // Ignore if modifier keys like Ctrl, Alt, Meta are held (unless Shift for '?')
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const key = e.key;

      // Handle Escape
      if (key === 'Escape') {
        if (isHelpOpen) {
          e.preventDefault();
          setIsHelpOpen(false);
        }
        setLastLeaderKey(null);
        return;
      }

      // Handle '?' to toggle shortcuts cheat sheet
      if (key === '?') {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
        setLastLeaderKey(null);
        return;
      }

      // Handle single-key shortcuts: ',' opens settings
      if (key === ',' && !lastLeaderKey) {
        e.preventDefault();
        navigateTo('settings');
        return;
      }

      // Two-key leader chord 'g' + <key>
      if (lastLeaderKey === 'g') {
        let route: NavRoute | null = null;
        if (key.toLowerCase() === 'h') route = 'home';
        else if (key.toLowerCase() === 's') route = 'study';
        else if (key.toLowerCase() === 'd') route = 'decks';
        else if (key.toLowerCase() === 'c' || key.toLowerCase() === 'b') route = 'collection';
        else if (key.toLowerCase() === 't') route = 'statistics';
        else if (key === ',') route = 'settings';

        if (route) {
          e.preventDefault();
          navigateTo(route);
        }

        setLastLeaderKey(null);
        if (chordTimeout) clearTimeout(chordTimeout);
        return;
      }

      if (key.toLowerCase() === 'g') {
        setLastLeaderKey('g');
        if (chordTimeout) clearTimeout(chordTimeout);
        chordTimeout = setTimeout(() => {
          setLastLeaderKey(null);
        }, 1200);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (chordTimeout) clearTimeout(chordTimeout);
    };
  }, [lastLeaderKey, isHelpOpen, navigateTo]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        isHelpOpen,
        setIsHelpOpen,
        toggleHelp: () => setIsHelpOpen((prev) => !prev),
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
};

export function useKeyboardShortcuts(): KeyboardShortcutsContextValue {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context;
}
