import { Rating, CardState } from './card';

export interface ReviewLog {
  id: string;
  cardId: string;
  rating: Rating;
  state: CardState;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  lastElapsedDays: number;
  scheduledDays: number;
  reviewTime: number;       // Unix timestamp in ms
  durationMs: number;       // Time spent on card before rating (in ms)
  deletedAt: number | null; // For soft-delete/sync tombstone
}
