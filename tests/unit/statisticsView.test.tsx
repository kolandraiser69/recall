import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatisticsView } from '../../src/ui/views/Statistics/StatisticsView';
import { NavigationProvider } from '../../src/ui/navigation/NavigationContext';
import { ToastProvider } from '../../src/ui/components/Toast';

describe('StatisticsView UI Tests', () => {
  beforeEach(async () => {
    // Clear and mock Dexie table states
    vi.clearAllMocks();
  });

  it('renders statistics view header and controls without crashing', async () => {
    render(
      <NavigationProvider>
        <ToastProvider>
          <StatisticsView />
        </ToastProvider>
      </NavigationProvider>
    );

    // Expect header
    expect(screen.getByText('Statistics & Insights')).toBeDefined();
    expect(
      screen.getByText('Track your memory retention, review habits, and long-term learning consistency.')
    ).toBeDefined();

    // Expect KPI sections
    expect(await screen.findByText('Reviews Completed')).toBeDefined();
    expect(await screen.findByText('Study Time')).toBeDefined();
    expect(await screen.findByText('Retention Rate')).toBeDefined();

    // Expect sections
    expect(screen.getByText(/Review Activity & Answer Distribution/i)).toBeDefined();
    expect(screen.getByText('Learning Consistency')).toBeDefined();
    expect(screen.getByText('FSRS-4.5 Algorithm Diagnostics')).toBeDefined();
    expect(screen.getByText('Deck Breakdown')).toBeDefined();
  });
});
