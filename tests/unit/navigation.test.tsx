import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { NavigationProvider, useNavigation } from '../../src/ui/navigation/NavigationContext';

const TestNavComponent = () => {
  const { currentRoute, navigateTo } = useNavigation();
  return (
    <div>
      <span data-testid="route">{currentRoute}</span>
      <button onClick={() => navigateTo('decks')}>Go Decks</button>
      <button onClick={() => navigateTo('study')}>Go Study</button>
      <button onClick={() => navigateTo('home')}>Go Home</button>
    </div>
  );
};

describe('Navigation System', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/recall/');
  });

  it('should default to home route when location is base path', () => {
    render(
      <NavigationProvider>
        <TestNavComponent />
      </NavigationProvider>
    );

    expect(screen.getByTestId('route').textContent).toBe('home');
  });

  it('should navigate to decks route and update browser history', () => {
    render(
      <NavigationProvider>
        <TestNavComponent />
      </NavigationProvider>
    );

    act(() => {
      screen.getByText('Go Decks').click();
    });

    expect(screen.getByTestId('route').textContent).toBe('decks');
    expect(window.location.pathname).toContain('decks');
  });

  it('should respond to browser popstate (back/forward)', () => {
    render(
      <NavigationProvider>
        <TestNavComponent />
      </NavigationProvider>
    );

    act(() => {
      screen.getByText('Go Study').click();
    });
    expect(screen.getByTestId('route').textContent).toBe('study');

    // Simulate browser back button
    act(() => {
      window.history.pushState({}, '', '/recall/decks');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByTestId('route').textContent).toBe('decks');
  });
});
