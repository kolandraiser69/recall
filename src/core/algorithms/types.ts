import type { Card, Rating } from '../models/card';

export interface NextIntervals {
  [Rating.Again]: { intervalLabel: string; scheduledDays: number; nextDue: Date };
  [Rating.Hard]: { intervalLabel: string; scheduledDays: number; nextDue: Date };
  [Rating.Good]: { intervalLabel: string; scheduledDays: number; nextDue: Date };
  [Rating.Easy]: { intervalLabel: string; scheduledDays: number; nextDue: Date };
  [Rating.Manual]: { intervalLabel: string; scheduledDays: number; nextDue: Date };
}

export interface FSRSSchedulerService {
  calculateNextReview(card: Card, rating: Rating, reviewTime?: Date): { card: Card; reviewLogData: unknown };
  getNextIntervals(card: Card, targetRetention?: number): NextIntervals;
  getDueCards(cards: Card[], dayCutoffTimestamp: number): Card[];
}
