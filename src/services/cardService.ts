import { db, type RecallDatabase } from '../db/database';
import { CardGenerationEngine } from '../core/templates/cardGenerationEngine';
import type { Card } from '../core/models/card';
import type { Note } from '../core/models/note';
import type { NoteType } from '../core/models/noteType';
import type { Deck } from '../core/models/deck';
import { cardSchema } from '../core/validation/card.schema';
import { noteSchema } from '../core/validation/note.schema';
import { generateId } from '../utils/id';

export interface NoteWithCards {
  note: Note;
  cards: Card[];
  noteType: NoteType;
  decks: Deck[];
}

export class CardService {
  constructor(private database: RecallDatabase = db) {}

  /**
   * Synchronizes cards for a note inside an atomic Dexie transaction.
   * - Preserves existing card IDs, FSRS learning progress, lapses, reps, and reviews.
   * - Creates newly required cards.
   * - Marks obsolete cards as soft-deleted (deletedAt timestamp).
   *
   * @param noteId ID of the note.
   * @param targetDeckId Deck ID to use if new cards need to be created.
   * @returns List of all resulting active cards.
   */
  async syncCardsForNote(noteId: string, targetDeckId?: string): Promise<Card[]> {
    return this.database.transaction('rw', [this.database.notes, this.database.noteTypes, this.database.cards], async () => {
      const note = await this.database.notes.get(noteId);
      if (!note || note.deletedAt !== null) {
        throw new Error(`Cannot sync cards: Note with id ${noteId} not found or deleted.`);
      }

      const noteType = await this.database.noteTypes.get(note.noteTypeId);
      if (!noteType) {
        throw new Error(`Cannot sync cards: NoteType ${note.noteTypeId} not found.`);
      }

      // Fetch all existing cards for this note (including soft-deleted)
      const existingCards = await this.database.cards.where('noteId').equals(noteId).toArray();

      // Determine the deck to place new cards in:
      // 1. Specified targetDeckId
      // 2. Or the deckId of existing active cards of this note
      // 3. Or fallback to the first active deck in the database
      let deckId = targetDeckId;
      if (!deckId) {
        const firstExisting = existingCards.find((c) => c.deletedAt === null);
        if (firstExisting) {
          deckId = firstExisting.deckId;
        } else {
          const firstDeck = await this.database.decks.filter((d) => d.deletedAt === null).first();
          deckId = firstDeck ? firstDeck.id : 'default-deck';
        }
      }

      // Plan diff using stateless CardGenerationEngine
      const plan = CardGenerationEngine.planCardsForNote(note, noteType, deckId, existingCards);

      // Validate and insert newly created cards
      if (plan.toCreate.length > 0) {
        const validatedToCreate = plan.toCreate.map((c) => cardSchema.parse(c));
        await this.database.cards.bulkAdd(validatedToCreate);
      }

      // Update existing cards (timestamps / properties)
      if (plan.toUpdate.length > 0) {
        const validatedToUpdate = plan.toUpdate.map((c) => cardSchema.parse(c));
        await this.database.cards.bulkPut(validatedToUpdate);
      }

      // Soft-delete obsolete cards
      if (plan.toDelete.length > 0) {
        const validatedToDelete = plan.toDelete.map((c) => cardSchema.parse(c));
        await this.database.cards.bulkPut(validatedToDelete);
      }

      return plan.allActive;
    });
  }

  /**
   * Creates a new note and atomically generates all corresponding cards within a single transaction.
   */
  async createNoteWithCards(params: {
    noteTypeId: string;
    deckId: string;
    fieldValues: Record<string, string>;
    tags?: string[];
  }): Promise<{ note: Note; cards: Card[] }> {
    return this.database.transaction('rw', [this.database.notes, this.database.noteTypes, this.database.cards], async () => {
      const noteType = await this.database.noteTypes.get(params.noteTypeId);
      if (!noteType) {
        throw new Error(`NoteType ${params.noteTypeId} not found`);
      }

      const now = Date.now();
      const newNote: Note = {
        id: generateId(),
        noteTypeId: params.noteTypeId,
        fieldValues: params.fieldValues,
        tags: params.tags ?? [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      const validatedNote = noteSchema.parse(newNote);
      await this.database.notes.add(validatedNote);

      const plan = CardGenerationEngine.planCardsForNote(validatedNote, noteType, params.deckId, []);
      const validatedCards = plan.toCreate.map((c) => cardSchema.parse(c));
      await this.database.cards.bulkAdd(validatedCards);

      return {
        note: validatedNote,
        cards: validatedCards,
      };
    });
  }

  /**
   * Updates note fields, tags, and/or noteTypeId, and re-synchronizes all associated cards atomically.
   */
  async updateNoteAndSync(
    noteId: string,
    updates: {
      fieldValues?: Record<string, string>;
      tags?: string[];
      noteTypeId?: string;
      targetDeckId?: string;
    }
  ): Promise<{ note: Note; cards: Card[] }> {
    return this.database.transaction('rw', [this.database.notes, this.database.noteTypes, this.database.cards], async () => {
      const existing = await this.database.notes.get(noteId);
      if (!existing || existing.deletedAt !== null) {
        throw new Error(`Note ${noteId} not found`);
      }

      const newNoteTypeId = updates.noteTypeId ?? existing.noteTypeId;
      const updatedNote: Note = {
        ...existing,
        noteTypeId: newNoteTypeId,
        fieldValues: updates.fieldValues ?? existing.fieldValues,
        tags: updates.tags ?? existing.tags,
        updatedAt: Date.now(),
      };

      const validatedNote = noteSchema.parse(updatedNote);
      await this.database.notes.put(validatedNote);

      const noteType = await this.database.noteTypes.get(newNoteTypeId);
      if (!noteType) {
        throw new Error(`NoteType ${newNoteTypeId} not found`);
      }

      const existingCards = await this.database.cards.where('noteId').equals(noteId).toArray();
      const defaultDeckId =
        updates.targetDeckId ??
        existingCards.find((c) => c.deletedAt === null)?.deckId ??
        existingCards[0]?.deckId ??
        'default';

      const plan = CardGenerationEngine.planCardsForNote(validatedNote, noteType, defaultDeckId, existingCards);

      if (plan.toCreate.length > 0) {
        await this.database.cards.bulkAdd(plan.toCreate.map((c) => cardSchema.parse(c)));
      }
      if (plan.toUpdate.length > 0) {
        await this.database.cards.bulkPut(plan.toUpdate.map((c) => cardSchema.parse(c)));
      }
      if (plan.toDelete.length > 0) {
        await this.database.cards.bulkPut(plan.toDelete.map((c) => cardSchema.parse(c)));
      }

      return {
        note: validatedNote,
        cards: plan.allActive,
      };
    });
  }

  /**
   * Toggles the suspended state for a single card.
   */
  async setCardSuspended(cardId: string, isSuspended: boolean): Promise<Card> {
    const card = await this.database.cards.get(cardId);
    if (!card || card.deletedAt !== null) {
      throw new Error(`Card ${cardId} not found`);
    }

    const updated: Card = {
      ...card,
      isSuspended,
      updatedAt: Date.now(),
    };

    const validated = cardSchema.parse(updated);
    await this.database.cards.put(validated);
    return validated;
  }

  /**
   * Toggles the flagged state for a single card.
   */
  async setCardFlagged(cardId: string, isFlagged: boolean): Promise<Card> {
    const card = await this.database.cards.get(cardId);
    if (!card || card.deletedAt !== null) {
      throw new Error(`Card ${cardId} not found`);
    }

    const updated: Card = {
      ...card,
      isFlagged,
      updatedAt: Date.now(),
    };

    const validated = cardSchema.parse(updated);
    await this.database.cards.put(validated);
    return validated;
  }

  /**
   * Moves a single card to a new target deck.
   */
  async moveCard(cardId: string, targetDeckId: string): Promise<Card> {
    return this.database.transaction('rw', [this.database.cards, this.database.decks], async () => {
      const deck = await this.database.decks.get(targetDeckId);
      if (!deck || deck.deletedAt !== null) {
        throw new Error(`Target deck ${targetDeckId} not found`);
      }

      const card = await this.database.cards.get(cardId);
      if (!card || card.deletedAt !== null) {
        throw new Error(`Card ${cardId} not found`);
      }

      const updated: Card = {
        ...card,
        deckId: targetDeckId,
        updatedAt: Date.now(),
      };

      const validated = cardSchema.parse(updated);
      await this.database.cards.put(validated);
      return validated;
    });
  }

  /**
   * Moves all cards belonging to a note to a new target deck.
   */
  async moveAllCardsOfNote(noteId: string, targetDeckId: string): Promise<void> {
    await this.database.transaction('rw', [this.database.cards, this.database.decks], async () => {
      const deck = await this.database.decks.get(targetDeckId);
      if (!deck || deck.deletedAt !== null) {
        throw new Error(`Target deck ${targetDeckId} not found`);
      }

      const activeCards = await this.database.cards
        .where('noteId')
        .equals(noteId)
        .filter((c) => c.deletedAt === null)
        .toArray();

      const now = Date.now();
      for (const card of activeCards) {
        card.deckId = targetDeckId;
        card.updatedAt = now;
      }

      await this.database.cards.bulkPut(activeCards);
    });
  }

  /**
   * Soft-deletes a single card.
   * Notes and other sibling cards are preserved. ReviewLogs remain permanently.
   */
  async deleteCard(cardId: string): Promise<void> {
    const card = await this.database.cards.get(cardId);
    if (!card || card.deletedAt !== null) {
      throw new Error(`Card ${cardId} not found`);
    }

    const now = Date.now();
    await this.database.cards.update(cardId, {
      deletedAt: now,
      updatedAt: now,
    });
  }

  /**
   * Soft-deletes a note and all its child cards atomically.
   * ReviewLogs remain permanently in the database to safeguard learning analytics.
   */
  async deleteNoteAndCards(noteId: string): Promise<void> {
    await this.database.transaction('rw', [this.database.notes, this.database.cards], async () => {
      const now = Date.now();
      await this.database.notes.update(noteId, { deletedAt: now, updatedAt: now });

      const childCards = await this.database.cards.where('noteId').equals(noteId).toArray();
      const softDeleted = childCards.map((c) => ({
        ...c,
        deletedAt: now,
        updatedAt: now,
      }));
      await this.database.cards.bulkPut(softDeleted);
    });
  }

  /**
   * Efficiently loads notes with their cards, noteType, and deck metadata for collection browsing.
   */
  async getCollectionItems(): Promise<NoteWithCards[]> {
    const [notes, cards, noteTypes, decks] = await Promise.all([
      this.database.notes.filter((n) => n.deletedAt === null).toArray(),
      this.database.cards.filter((c) => c.deletedAt === null).toArray(),
      this.database.noteTypes.filter((nt) => nt.deletedAt === null).toArray(),
      this.database.decks.filter((d) => d.deletedAt === null).toArray(),
    ]);

    const noteTypeMap = new Map<string, NoteType>(noteTypes.map((nt) => [nt.id, nt]));
    const deckMap = new Map<string, Deck>(decks.map((d) => [d.id, d]));

    // Group cards by noteId
    const cardsByNoteId = new Map<string, Card[]>();
    for (const card of cards) {
      const list = cardsByNoteId.get(card.noteId) ?? [];
      list.push(card);
      cardsByNoteId.set(card.noteId, list);
    }

    const items: NoteWithCards[] = [];
    for (const note of notes) {
      const noteType = noteTypeMap.get(note.noteTypeId);
      if (!noteType) continue;

      const noteCards = cardsByNoteId.get(note.id) ?? [];
      const deckIds = Array.from(new Set(noteCards.map((c) => c.deckId)));
      const noteDecks = deckIds.map((dId) => deckMap.get(dId)).filter((d): d is Deck => Boolean(d));

      items.push({
        note,
        cards: noteCards,
        noteType,
        decks: noteDecks,
      });
    }

    // Default sort: recently updated descending
    return items.sort((a, b) => b.note.updatedAt - a.note.updatedAt);
  }
}

export const cardService = new CardService(db);
