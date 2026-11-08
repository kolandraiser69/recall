import { fsrs, generatorParameters, type Card as TsFsrsCard, type StepUnit } from 'ts-fsrs';
import type { Card, FSRSData } from '../core/models/card';
import { CardState, Rating } from '../core/models/card';
import type { DeckSettings } from '../core/models/deck';
import { DEFAULT_DECK_SETTINGS } from '../core/models/deck';
import type { ReviewLog } from '../core/models/review';
import type { NextIntervals } from '../core/algorithms/types';

/**
 * Maps minutes numbers to ts-fsrs StepUnit strings (e.g. 1 -> '1m', 1440 -> '1d').
 */
export function convertMinutesToStepUnits(stepsInMinutes: number[]): StepUnit[] {
  return stepsInMinutes
    .filter((m) => m > 0)
    .map((m) => {
      if (m % 1440 === 0) {
        return `${m / 1440}d` as StepUnit;
      }
      if (m % 60 === 0) {
        return `${m / 60}h` as StepUnit;
      }
      return `${m}m` as StepUnit;
    });
}

/**
 * Formats a time delta between now and due date into a human-readable interval badge.
 * Examples: '1m', '10m', '1d', '4d', '1.5mo', '1y'
 */
export function formatIntervalLabel(now: Date, due: Date): string {
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) return 'now';

  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;

  const months = (days / 30).toFixed(1).replace('.0', '');
  if (days < 365) return `${months}mo`;

  const years = (days / 365).toFixed(1).replace('.0', '');
  return `${years}y`;
}

/**
 * Maps our Recall domain Card to the ts-fsrs Card structure.
 */
export function toTsFsrsCard(card: Card): TsFsrsCard {
  return {
    due: new Date(card.due),
    stability: card.fsrs.stability,
    difficulty: card.fsrs.difficulty,
    scheduled_days: card.fsrs.scheduled_days,
    reps: card.fsrs.reps,
    lapses: card.fsrs.lapses,
    learning_steps: 0,
    state: card.state as 0 | 1 | 2 | 3,
    last_review: card.fsrs.last_review ? new Date(card.fsrs.last_review) : undefined,
  };
}

export interface ReviewCalculationResult {
  updatedCard: Card;
  reviewLogData: Omit<ReviewLog, 'id'>;
}

export class FSRSService {
  /**
   * Initializes a configured FSRS instance using DeckSettings or global defaults.
   */
  private getFsrsInstance(settings: DeckSettings = DEFAULT_DECK_SETTINGS) {
    const learningSteps = convertMinutesToStepUnits(
      settings.learningSteps && settings.learningSteps.length > 0
        ? settings.learningSteps
        : DEFAULT_DECK_SETTINGS.learningSteps
    );

    const relearningSteps = convertMinutesToStepUnits(
      settings.relearningSteps && settings.relearningSteps.length > 0
        ? settings.relearningSteps
        : DEFAULT_DECK_SETTINGS.relearningSteps
    );

    const params = generatorParameters({
      request_retention: settings.desiredRetention ?? DEFAULT_DECK_SETTINGS.desiredRetention,
      learning_steps: learningSteps,
      relearning_steps: relearningSteps,
      enable_fuzz: false, // Keep deterministic for reliable SRS scheduling
      enable_short_term: true,
      w: settings.fsrsParameters,
    });

    return fsrs(params);
  }

  /**
   * Calculates the scheduling results for all 4 rating choices (Again, Hard, Good, Easy)
   * without mutating the database or card state.
   */
  getNextIntervals(
    card: Card,
    settings: DeckSettings = DEFAULT_DECK_SETTINGS,
    now: Date = new Date()
  ): NextIntervals {
    const scheduler = this.getFsrsInstance(settings);
    const fsrsCard = toTsFsrsCard(card);
    const repeatResult = scheduler.repeat(fsrsCard, now);

    const getForRating = (r: 1 | 2 | 3 | 4) => {
      const item = repeatResult[r];
      const nextDue = item.card.due;
      return {
        intervalLabel: formatIntervalLabel(now, nextDue),
        scheduledDays: item.card.scheduled_days,
        nextDue,
        nextState: item.card.state as CardState,
      };
    };

    return {
      [Rating.Again]: getForRating(1),
      [Rating.Hard]: getForRating(2),
      [Rating.Good]: getForRating(3),
      [Rating.Easy]: getForRating(4),
      [Rating.Manual]: getForRating(3),
    };
  }

  /**
   * Calculates the updated Card and ReviewLog after a user rates a flashcard.
   *
   * @param card The current card before rating
   * @param rating Again (1), Hard (2), Good (3), or Easy (4)
   * @param settings Deck settings (desired retention, learning steps, etc.)
   * @param reviewTime Timestamp when review took place
   * @param durationMs Milliseconds user spent viewing the card
   */
  calculateNextReview(
    card: Card,
    rating: Rating,
    settings: DeckSettings = DEFAULT_DECK_SETTINGS,
    reviewTime: Date = new Date(),
    durationMs = 0
  ): ReviewCalculationResult {
    // Treat Manual as Good if passed
    const fsrsRatingKey = (rating === Rating.Manual ? Rating.Good : rating) as 1 | 2 | 3 | 4;

    const scheduler = this.getFsrsInstance(settings);
    const fsrsCard = toTsFsrsCard(card);
    const repeatResult = scheduler.repeat(fsrsCard, reviewTime);
    const ratedOutcome = repeatResult[fsrsRatingKey];

    const nextCardData = ratedOutcome.card;
    const nowMs = reviewTime.getTime();
    const elapsedDays = card.fsrs.last_review
      ? Math.max(0, Math.floor((nowMs - card.fsrs.last_review) / (24 * 3600 * 1000)))
      : 0;

    const updatedFsrs: FSRSData = {
      stability: nextCardData.stability,
      difficulty: nextCardData.difficulty,
      elapsed_days: elapsedDays,
      scheduled_days: nextCardData.scheduled_days,
      reps: nextCardData.reps,
      lapses: nextCardData.lapses,
      state: nextCardData.state as CardState,
      last_review: nowMs,
    };

    const updatedCard: Card = {
      ...card,
      state: nextCardData.state as CardState,
      due: nextCardData.due.getTime(),
      fsrs: updatedFsrs,
      updatedAt: nowMs,
    };

    const reviewLogData: Omit<ReviewLog, 'id'> = {
      cardId: card.id,
      rating,
      state: card.state, // State prior to review
      due: card.due,
      stability: card.fsrs.stability,
      difficulty: card.fsrs.difficulty,
      elapsedDays,
      lastElapsedDays: card.fsrs.elapsed_days,
      scheduledDays: nextCardData.scheduled_days,
      reviewTime: nowMs,
      durationMs: Math.max(0, durationMs),
      deletedAt: null,
    };

    return {
      updatedCard,
      reviewLogData,
    };
  }
}

export const fsrsService = new FSRSService();
