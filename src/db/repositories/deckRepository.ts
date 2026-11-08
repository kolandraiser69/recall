import type { RecallDatabase } from '../database';
import type { Deck, DeckSettings } from '../../core/models/deck';
import { DEFAULT_DECK_SETTINGS } from '../../core/models/deck';
import { deckSchema } from '../../core/validation/deck.schema';
import { generateId } from '../../utils/id';

export class DeckRepository {
  constructor(private db: RecallDatabase) {}

  async getById(id: string): Promise<Deck | undefined> {
    return this.db.decks.get(id);
  }

  async getAll(includeDeleted = false): Promise<Deck[]> {
    if (includeDeleted) {
      return this.db.decks.toArray();
    }
    return this.db.decks.filter((deck) => deck.deletedAt === null).toArray();
  }

  async getSubdecks(parentId: string, includeDeleted = false): Promise<Deck[]> {
    return this.db.decks
      .where('parentId')
      .equals(parentId)
      .filter((deck) => includeDeleted || deck.deletedAt === null)
      .toArray();
  }

  async create(data: {
    id?: string;
    name: string;
    parentId?: string | null;
    description?: string;
    settings?: Partial<DeckSettings>;
    order?: number;
  }): Promise<Deck> {
    const now = Date.now();
    const newDeck: Deck = {
      id: data.id ?? generateId(),
      name: data.name,
      parentId: data.parentId ?? null,
      description: data.description ?? '',
      settings: { ...DEFAULT_DECK_SETTINGS, ...data.settings },
      order: data.order ?? 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    // Validate with Zod
    const validated = deckSchema.parse(newDeck);
    await this.db.decks.add(validated);
    return validated;
  }

  async update(id: string, updates: Partial<Omit<Deck, 'id' | 'createdAt'>>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Deck with id ${id} not found`);
    }

    const updated: Deck = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const validated = deckSchema.parse(updated);
    await this.db.decks.put(validated);
  }

  async delete(id: string, hard = false): Promise<void> {
    if (hard) {
      await this.db.decks.delete(id);
    } else {
      await this.update(id, { deletedAt: Date.now() });
    }
  }
}
