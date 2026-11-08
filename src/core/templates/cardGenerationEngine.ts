import { ClozeEngine } from './clozeEngine';
import { TemplateRenderer } from './templateRenderer';
import type { Note } from '../models/note';
import type { NoteType } from '../models/noteType';
import type { Card } from '../models/card';
import { CardState } from '../models/card';
import { DEFAULT_INITIAL_FSRS } from '../../db/repositories/cardRepository';
import { generateId } from '../../utils/id';

export interface CardGenerationPlan {
  /** Cards that need to be inserted into the database */
  toCreate: Card[];
  /** Cards that already exist and need their timestamp or properties updated */
  toUpdate: Card[];
  /** Cards that existed previously but whose templates or cloze indices are no longer valid */
  toDelete: Card[];
  /** All resulting active cards for this note */
  allActive: Card[];
}

export class CardGenerationEngine {
  /**
   * Generates a deterministic synchronization plan for the cards of a note.
   *
   * @param note The source note with field values.
   * @param noteType The note type defining fields, templates, and cloze behavior.
   * @param defaultDeckId The deck ID to assign to newly created cards.
   * @param existingCards Existing cards currently associated with this note.
   */
  static planCardsForNote(
    note: Note,
    noteType: NoteType,
    defaultDeckId: string,
    existingCards: Card[] = []
  ): CardGenerationPlan {
    const now = Date.now();
    const activeExisting = existingCards.filter((c) => c.deletedAt === null);

    // Map existing active cards by templateIndex for quick lookup
    const existingByIndex = new Map<number, Card>();
    for (const card of activeExisting) {
      existingByIndex.set(card.templateIndex, card);
    }

    const neededIndices: number[] = [];

    if (noteType.isCloze) {
      // 1. Cloze Note Type
      // Scan all field values for cloze indices
      const clozeSet = new Set<number>();
      for (const val of Object.values(note.fieldValues)) {
        const found = ClozeEngine.extractClozeIndices(val);
        for (const idx of found) {
          clozeSet.add(idx);
        }
      }

      const sortedIndices = Array.from(clozeSet).sort((a, b) => a - b);
      // For each 1-based cloze number, templateIndex is (number - 1), e.g. c1 -> 0, c2 -> 1
      for (const cNum of sortedIndices) {
        // Validate that question is not empty
        const template = noteType.templates[0] || {
          name: 'Cloze',
          qfmt: '{{cloze:Text}}',
          afmt: '{{cloze:Text}}\n\n<hr id="answer">\n\n{{Back Extra}}',
        };

        if (!TemplateRenderer.isQuestionEmpty(template, note.fieldValues, cNum)) {
          neededIndices.push(cNum - 1);
        }
      }
    } else {
      // 2. Standard Note Type (Basic, Basic & Reversed, Custom)
      noteType.templates.forEach((template, index) => {
        // Only generate a card if the question template renders non-empty text
        if (!TemplateRenderer.isQuestionEmpty(template, note.fieldValues)) {
          neededIndices.push(index);
        }
      });
    }

    const toCreate: Card[] = [];
    const toUpdate: Card[] = [];
    const allActive: Card[] = [];
    const neededIndexSet = new Set(neededIndices);

    for (const index of neededIndices) {
      const existing = existingByIndex.get(index);
      if (existing) {
        // Card already exists: preserve ID, deckId, FSRS state, created timestamp!
        const updatedCard: Card = {
          ...existing,
          updatedAt: now,
        };
        toUpdate.push(updatedCard);
        allActive.push(updatedCard);
      } else {
        // Create new card
        const newCard: Card = {
          id: generateId(),
          noteId: note.id,
          deckId: defaultDeckId,
          templateIndex: index,
          state: CardState.New,
          due: now,
          fsrs: { ...DEFAULT_INITIAL_FSRS },
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        toCreate.push(newCard);
        allActive.push(newCard);
      }
    }

    // Determine cards that are no longer needed (e.g. c2 was deleted from note text)
    const toDelete: Card[] = [];
    for (const existing of activeExisting) {
      if (!neededIndexSet.has(existing.templateIndex)) {
        toDelete.push({
          ...existing,
          deletedAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      toCreate,
      toUpdate,
      toDelete,
      allActive,
    };
  }
}
