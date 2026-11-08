import Dexie from 'dexie';
import type { RecallDatabase } from '../database';
import type { Card, FSRSData } from '../../core/models/card';
import { CardState } from '../../core/models/card';
import { cardSchema } from '../../core/validation/card.schema';
import { generateId } from '../../utils/id';

export const DEFAULT_INITIAL_FSRS: FSRSData = {
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  reps: 0,
  lapses: 0,
  state: CardState.New,
};

export class CardRepository {
  constructor(private db: RecallDatabase) {}

  async getById(id: string): Promise<Card | undefined> {
    return this.db.cards.get(id);
  }

  async getAll(includeDeleted = false): Promise<Card[]> {
    if (includeDeleted) {
      return this.db.cards.toArray();
    }
    return this.db.cards.filter((card) => card.deletedAt === null).toArray();
  }

  async getByNoteId(noteId: string, includeDeleted = false): Promise<Card[]> {
    return this.db.cards
      .where('noteId')
      .equals(noteId)
      .filter((card) => includeDeleted || card.deletedAt === null)
      .toArray();
  }

  async getByDeckId(deckId: string, includeDeleted = false): Promise<Card[]> {
    return this.db.cards
      .where('deckId')
      .equals(deckId)
      .filter((card) => includeDeleted || card.deletedAt === null)
      .toArray();
  }

  /**
   * Retrieves cards due for study up to a given timestamp.
   * Utilizes the [deckId+due] compound index.
   */
  async getDueCards(deckId: string, maxDueTimestamp: number): Promise<Card[]> {
    return this.db.cards
      .where('[deckId+due]')
      .between([deckId, Dexie.minKey], [deckId, maxDueTimestamp], true, true)
      .filter((card) => card.deletedAt === null)
      .toArray();
  }

  async create(data: {
    id?: string;
    noteId: string;
    deckId: string;
    templateIndex: number;
    state?: CardState;
    due?: number;
    fsrs?: Partial<FSRSData>;
  }): Promise<Card> {
    const now = Date.now();
    const newCard: Card = {
      id: data.id ?? generateId(),
      noteId: data.noteId,
      deckId: data.deckId,
      templateIndex: data.templateIndex,
      state: data.state ?? CardState.New,
      due: data.due ?? now,
      fsrs: { ...DEFAULT_INITIAL_FSRS, ...data.fsrs },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const validated = cardSchema.parse(newCard);
    await this.db.cards.add(validated);
    return validated;
  }

  async createMany(cards: Card[]): Promise<void> {
    const validated = cards.map((c) => cardSchema.parse(c));
    await this.db.cards.bulkAdd(validated);
  }

  async update(id: string, updates: Partial<Omit<Card, 'id' | 'createdAt'>>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Card with id ${id} not found`);
    }

    const updated: Card = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const validated = cardSchema.parse(updated);
    await this.db.cards.put(validated);
  }

  async delete(id: string, hard = false): Promise<void> {
    if (hard) {
      await this.db.cards.delete(id);
    } else {
      await this.update(id, { deletedAt: Date.now() });
    }
  }

  async deleteByNoteId(noteId: string, hard = false): Promise<void> {
    const cards = await this.getByNoteId(noteId, true);
    if (hard) {
      await this.db.cards.bulkDelete(cards.map((c) => c.id));
    } else {
      const now = Date.now();
      const softDeleted = cards.map((c) => ({
        ...c,
        deletedAt: now,
        updatedAt: now,
      }));
      await this.db.cards.bulkPut(softDeleted);
    }
  }
}
