import { describe, it, expect } from 'vitest';
import { CardGenerationEngine } from '../../src/core/templates/cardGenerationEngine';
import { CardState, type Card } from '../../src/core/models/card';
import type { Note } from '../../src/core/models/note';
import { DEFAULT_NOTE_TYPES } from '../../src/db/migrations/v1';

describe('CardGenerationEngine', () => {
  const basicNoteType = DEFAULT_NOTE_TYPES.find((n) => n.id === 'default-basic')!;
  const reversedNoteType = DEFAULT_NOTE_TYPES.find((n) => n.id === 'default-reversed')!;
  const clozeNoteType = DEFAULT_NOTE_TYPES.find((n) => n.id === 'default-cloze')!;

  it('should plan 1 card for Basic NoteType', () => {
    const note: Note = {
      id: 'note-basic',
      noteTypeId: basicNoteType.id,
      fieldValues: { Front: 'Question 1', Back: 'Answer 1' },
      tags: [],
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    };

    const plan = CardGenerationEngine.planCardsForNote(note, basicNoteType, 'deck-1', []);

    expect(plan.toCreate.length).toBe(1);
    expect(plan.toUpdate.length).toBe(0);
    expect(plan.toDelete.length).toBe(0);
    expect(plan.allActive.length).toBe(1);
    expect(plan.toCreate[0]?.templateIndex).toBe(0);
    expect(plan.toCreate[0]?.state).toBe(CardState.New);
  });

  it('should plan 2 cards for Basic (and reversed) NoteType', () => {
    const note: Note = {
      id: 'note-reversed',
      noteTypeId: reversedNoteType.id,
      fieldValues: { Front: 'English', Back: 'German' },
      tags: [],
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    };

    const plan = CardGenerationEngine.planCardsForNote(note, reversedNoteType, 'deck-1', []);

    expect(plan.toCreate.length).toBe(2);
    expect(plan.toCreate[0]?.templateIndex).toBe(0);
    expect(plan.toCreate[1]?.templateIndex).toBe(1);
    expect(plan.allActive.length).toBe(2);
  });

  it('should plan cards dynamically based on cloze indices for Cloze NoteType', () => {
    const note: Note = {
      id: 'note-cloze',
      noteTypeId: clozeNoteType.id,
      fieldValues: {
        Text: 'The {{c1::Sun}} is at the center of the {{c2::Solar System}} with {{c1::heliocentric}} model.',
        'Back Extra': 'Astronomy fact',
      },
      tags: [],
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    };

    const plan = CardGenerationEngine.planCardsForNote(note, clozeNoteType, 'deck-1', []);

    // 2 unique cloze numbers -> 2 cards (indices 0 and 1)
    expect(plan.toCreate.length).toBe(2);
    expect(plan.toCreate[0]?.templateIndex).toBe(0); // c1
    expect(plan.toCreate[1]?.templateIndex).toBe(1); // c2
  });

  it('should preserve existing card IDs and FSRS state during re-planning', () => {
    const note: Note = {
      id: 'note-persisted',
      noteTypeId: reversedNoteType.id,
      fieldValues: { Front: 'Word', Back: 'Wort' },
      tags: [],
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    };

    const existingCard0: Card = {
      id: 'existing-card-id-0',
      noteId: note.id,
      deckId: 'custom-deck-99',
      templateIndex: 0,
      state: CardState.Review,
      due: 5000000,
      fsrs: {
        stability: 14.5,
        difficulty: 4.2,
        elapsed_days: 10,
        scheduled_days: 14,
        reps: 5,
        lapses: 0,
        state: CardState.Review,
      },
      createdAt: 1000,
      updatedAt: 2000,
      deletedAt: null,
    };

    // Re-plan with existing card for templateIndex 0
    const plan = CardGenerationEngine.planCardsForNote(note, reversedNoteType, 'default-deck', [existingCard0]);

    // templateIndex 0 is updated (retained ID & FSRS), templateIndex 1 is created
    expect(plan.toUpdate.length).toBe(1);
    expect(plan.toCreate.length).toBe(1);
    expect(plan.toDelete.length).toBe(0);

    const retained = plan.toUpdate[0];
    expect(retained?.id).toBe('existing-card-id-0');
    expect(retained?.deckId).toBe('custom-deck-99');
    expect(retained?.state).toBe(CardState.Review);
    expect(retained?.fsrs.stability).toBe(14.5);
    expect(retained?.fsrs.reps).toBe(5);
  });

  it('should mark removed cloze cards as toDelete without touching retained cards', () => {
    const noteWithOneCloze: Note = {
      id: 'note-cloze-reduced',
      noteTypeId: clozeNoteType.id,
      // User removed {{c2::...}} from the text
      fieldValues: { Text: 'Only {{c1::one cloze}} remains now.', 'Back Extra': '' },
      tags: [],
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    };

    const cardC1: Card = {
      id: 'card-c1',
      noteId: noteWithOneCloze.id,
      deckId: 'deck-1',
      templateIndex: 0, // c1
      state: CardState.Review,
      due: 2000,
      fsrs: { stability: 5, difficulty: 5, elapsed_days: 1, scheduled_days: 5, reps: 2, lapses: 0, state: CardState.Review },
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    };

    const cardC2: Card = {
      id: 'card-c2',
      noteId: noteWithOneCloze.id,
      deckId: 'deck-1',
      templateIndex: 1, // c2 (now obsolete)
      state: CardState.Learning,
      due: 1500,
      fsrs: { stability: 1, difficulty: 6, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: CardState.Learning },
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    };

    const plan = CardGenerationEngine.planCardsForNote(noteWithOneCloze, clozeNoteType, 'deck-1', [cardC1, cardC2]);

    expect(plan.toUpdate.length).toBe(1); // cardC1 kept
    expect(plan.toUpdate[0]?.id).toBe('card-c1');
    expect(plan.toDelete.length).toBe(1); // cardC2 soft-deleted
    expect(plan.toDelete[0]?.id).toBe('card-c2');
    expect(plan.toDelete[0]?.deletedAt).not.toBeNull();
  });
});
