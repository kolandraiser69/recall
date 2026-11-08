import { describe, it, expect } from 'vitest';
import { fsrsService, formatIntervalLabel, convertMinutesToStepUnits } from '../../src/services/fsrsService';
import type { Card } from '../../src/core/models/card';
import { CardState, Rating } from '../../src/core/models/card';
import { DEFAULT_DECK_SETTINGS } from '../../src/core/models/deck';
import { DEFAULT_INITIAL_FSRS } from '../../src/db/repositories/cardRepository';

describe('FSRSService (FSRS-4.5 Scheduling Engine)', () => {
  const baseCard: Card = {
    id: 'test-card-1',
    noteId: 'test-note-1',
    deckId: 'test-deck-1',
    templateIndex: 0,
    state: CardState.New,
    due: Date.now(),
    fsrs: { ...DEFAULT_INITIAL_FSRS },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  };

  describe('Step unit conversion & label formatting', () => {
    it('converts minutes to appropriate step units', () => {
      expect(convertMinutesToStepUnits([1, 10])).toEqual(['1m', '10m']);
      expect(convertMinutesToStepUnits([60, 120])).toEqual(['1h', '2h']);
      expect(convertMinutesToStepUnits([1440, 2880])).toEqual(['1d', '2d']);
    });

    it('formats interval labels correctly', () => {
      const now = new Date(1700000000000);
      expect(formatIntervalLabel(now, new Date(now.getTime() + 10000))).toBe('10s');
      expect(formatIntervalLabel(now, new Date(now.getTime() + 60000))).toBe('1m');
      expect(formatIntervalLabel(now, new Date(now.getTime() + 600000))).toBe('10m');
      expect(formatIntervalLabel(now, new Date(now.getTime() + 3600000 * 2))).toBe('2h');
      expect(formatIntervalLabel(now, new Date(now.getTime() + 86400000 * 4))).toBe('4d');
      expect(formatIntervalLabel(now, new Date(now.getTime() + 86400000 * 45))).toBe('1.5mo');
      expect(formatIntervalLabel(now, new Date(now.getTime() + 86400000 * 400))).toBe('1.1y');
    });
  });

  describe('New Card Calculations', () => {
    it('calculates preview intervals for all ratings on a new card', () => {
      const now = new Date();
      const intervals = fsrsService.getNextIntervals(baseCard, DEFAULT_DECK_SETTINGS, now);

      expect(intervals[Rating.Again]).toBeDefined();
      expect(intervals[Rating.Hard]).toBeDefined();
      expect(intervals[Rating.Good]).toBeDefined();
      expect(intervals[Rating.Easy]).toBeDefined();

      // Again is intraday (1m step)
      expect(intervals[Rating.Again].intervalLabel).toBe('1m');
      // Good is next step (10m)
      expect(intervals[Rating.Good].intervalLabel).toBe('10m');
      // Easy directly graduates
      expect(intervals[Rating.Easy].scheduledDays).toBeGreaterThan(0);
    });

    it('transitions new card to learning on Again/Hard/Good and review on Easy', () => {
      const now = new Date();

      const resAgain = fsrsService.calculateNextReview(baseCard, Rating.Again, DEFAULT_DECK_SETTINGS, now);
      expect(resAgain.updatedCard.state).toBe(CardState.Learning);
      expect(resAgain.updatedCard.fsrs.reps).toBe(1);
      expect(resAgain.reviewLogData.state).toBe(CardState.New);

      const resEasy = fsrsService.calculateNextReview(baseCard, Rating.Easy, DEFAULT_DECK_SETTINGS, now);
      expect(resEasy.updatedCard.state).toBe(CardState.Review);
      expect(resEasy.updatedCard.fsrs.reps).toBe(1);
      expect(resEasy.updatedCard.fsrs.scheduled_days).toBeGreaterThan(0);
    });
  });

  describe('Review State Transitions & Deck Settings', () => {
    const reviewCard: Card = {
      ...baseCard,
      state: CardState.Review,
      fsrs: {
        stability: 4.5,
        difficulty: 5.2,
        elapsed_days: 4,
        scheduled_days: 4,
        reps: 3,
        lapses: 0,
        state: CardState.Review,
        last_review: Date.now() - 4 * 86400000,
      },
    };

    it('drops review card into Relearning on Rating.Again', () => {
      const now = new Date();
      const result = fsrsService.calculateNextReview(reviewCard, Rating.Again, DEFAULT_DECK_SETTINGS, now);

      expect(result.updatedCard.state).toBe(CardState.Relearning);
      expect(result.updatedCard.fsrs.lapses).toBe(1);
      expect(result.updatedCard.fsrs.reps).toBe(4);
      expect(result.updatedCard.fsrs.scheduled_days).toBe(0);
      expect(result.reviewLogData.rating).toBe(Rating.Again);
      expect(result.reviewLogData.state).toBe(CardState.Review);
    });

    it('increases stability and scheduled days on Rating.Good', () => {
      const now = new Date();
      const result = fsrsService.calculateNextReview(reviewCard, Rating.Good, DEFAULT_DECK_SETTINGS, now);

      expect(result.updatedCard.state).toBe(CardState.Review);
      expect(result.updatedCard.fsrs.reps).toBe(4);
      expect(result.updatedCard.fsrs.stability).toBeGreaterThan(reviewCard.fsrs.stability);
      expect(result.updatedCard.fsrs.scheduled_days).toBeGreaterThan(reviewCard.fsrs.scheduled_days);
    });

    it('respects desired retention setting from deck', () => {
      const now = new Date();
      const highRetentionSettings = { ...DEFAULT_DECK_SETTINGS, desiredRetention: 0.95 };
      const lowRetentionSettings = { ...DEFAULT_DECK_SETTINGS, desiredRetention: 0.80 };

      const resHigh = fsrsService.calculateNextReview(reviewCard, Rating.Good, highRetentionSettings, now);
      const resLow = fsrsService.calculateNextReview(reviewCard, Rating.Good, lowRetentionSettings, now);

      // Higher requested retention leads to shorter scheduled intervals to reduce forgetting risk
      expect(resHigh.updatedCard.fsrs.scheduled_days).toBeLessThanOrEqual(resLow.updatedCard.fsrs.scheduled_days);
    });
  });
});
