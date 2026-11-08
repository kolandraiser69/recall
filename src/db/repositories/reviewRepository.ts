import Dexie from 'dexie';
import type { RecallDatabase } from '../database';
import type { ReviewLog } from '../../core/models/review';
import type { CardState, Rating } from '../../core/models/card';
import { reviewLogSchema } from '../../core/validation/review.schema';
import { generateId } from '../../utils/id';

export class ReviewRepository {
  constructor(private db: RecallDatabase) {}

  async getById(id: string): Promise<ReviewLog | undefined> {
    return this.db.reviews.get(id);
  }

  async getAll(includeDeleted = false): Promise<ReviewLog[]> {
    if (includeDeleted) {
      return this.db.reviews.toArray();
    }
    return this.db.reviews.filter((r) => r.deletedAt === null).toArray();
  }

  /**
   * Retrieves review logs for a specific card sorted chronologically.
   * Utilizes the [cardId+reviewTime] compound index for direct index seeks.
   */
  async getByCardId(cardId: string, includeDeleted = false): Promise<ReviewLog[]> {
    return this.db.reviews
      .where('[cardId+reviewTime]')
      .between([cardId, Dexie.minKey], [cardId, Dexie.maxKey], true, true)
      .filter((r) => includeDeleted || r.deletedAt === null)
      .toArray();
  }

  /**
   * Retrieves the most recent review log for a given card.
   */
  async getLatestForCard(cardId: string): Promise<ReviewLog | undefined> {
    return this.db.reviews
      .where('[cardId+reviewTime]')
      .between([cardId, Dexie.minKey], [cardId, Dexie.maxKey], true, true)
      .filter((r) => r.deletedAt === null)
      .last();
  }

  async create(data: {
    id?: string;
    cardId: string;
    rating: Rating;
    state: CardState;
    due: number;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    lastElapsedDays: number;
    scheduledDays: number;
    reviewTime?: number;
    durationMs?: number;
  }): Promise<ReviewLog> {
    const newLog: ReviewLog = {
      id: data.id ?? generateId(),
      cardId: data.cardId,
      rating: data.rating,
      state: data.state,
      due: data.due,
      stability: data.stability,
      difficulty: data.difficulty,
      elapsedDays: data.elapsedDays,
      lastElapsedDays: data.lastElapsedDays,
      scheduledDays: data.scheduledDays,
      reviewTime: data.reviewTime ?? Date.now(),
      durationMs: data.durationMs ?? 0,
      deletedAt: null,
    };

    const validated = reviewLogSchema.parse(newLog);
    await this.db.reviews.add(validated);
    return validated;
  }

  async delete(id: string, hard = false): Promise<void> {
    if (hard) {
      await this.db.reviews.delete(id);
    } else {
      await this.db.reviews.update(id, { deletedAt: Date.now() });
    }
  }
}
