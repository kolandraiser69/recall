import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationProvider, useNavigation } from '../../src/ui/navigation/NavigationContext';
import { KeyboardShortcutsProvider, useKeyboardShortcuts } from '../../src/ui/keyboard/KeyboardShortcutsProvider';

const ShortcutsTestConsumer = () => {
  const { currentRoute } = useNavigation();
  const { isHelpOpen } = useKeyboardShortcuts();

  return (
    <div>
      <span data-testid="route">{currentRoute}</span>
      <span data-testid="help">{isHelpOpen ? 'open' : 'closed'}</span>
      <input data-testid="text-input" placeholder="Type here..." />
    </div>
  );
};

describe('Keyboard Shortcuts Engine', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/recall/');
  });

  it('should navigate via two-key chord g + s to study', () => {
    render(
      <NavigationProvider>
        <KeyboardShortcutsProvider>
          <ShortcutsTestConsumer />
        </KeyboardShortcutsProvider>
      </NavigationProvider>
    );

    expect(screen.getByTestId('route').textContent).toBe('home');

    // Press 'g' then 's'
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 's' });

    expect(screen.getByTestId('route').textContent).toBe('study');
  });

  it('should toggle help cheatsheet when ? is pressed', () => {
    render(
      <NavigationProvider>
        <KeyboardShortcutsProvider>
          <ShortcutsTestConsumer />
        </KeyboardShortcutsProvider>
      </NavigationProvider>
    );

    expect(screen.getByTestId('help').textContent).toBe('closed');

    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByTestId('help').textContent).toBe('open');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('help').textContent).toBe('closed');
  });

  it('should NOT trigger shortcuts when typing inside an input field', () => {
    render(
      <NavigationProvider>
        <KeyboardShortcutsProvider>
          <ShortcutsTestConsumer />
        </KeyboardShortcutsProvider>
      </NavigationProvider>
    );

    expect(screen.getByTestId('route').textContent).toBe('home');

    const input = screen.getByTestId('text-input');
    input.focus();

    // Type 'g' then 's' inside the focused input
    fireEvent.keyDown(input, { key: 'g' });
    fireEvent.keyDown(input, { key: 's' });

    // Route should remain unchanged at home
    expect(screen.getByTestId('route').textContent).toBe('home');
  });
});
