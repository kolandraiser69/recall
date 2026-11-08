import { describe, it, expect } from 'vitest';
import { CardState, Rating } from '../../src/core/models/card';
import {
  cardSchema,
  noteSchema,
  deckSchema,
  noteTypeSchema,
  reviewLogSchema,
  mediaItemSchema,
} from '../../src/core/validation';

describe('Domain Models & Zod Validation', () => {
  describe('Card & FSRS Schema', () => {
    it('should validate a valid card with FSRS parameters', () => {
      const validCard = {
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        templateIndex: 0,
        state: CardState.New,
        due: Date.now(),
        fsrs: {
          stability: 2.5,
          difficulty: 5.0,
          elapsed_days: 0,
          scheduled_days: 1,
          reps: 1,
          lapses: 0,
          state: CardState.Learning,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      };

      const result = cardSchema.safeParse(validCard);
      expect(result.success).toBe(true);
    });

    it('should reject invalid card ratings or negative intervals', () => {
      const invalidCard = {
        id: '',
        noteId: 'note-1',
        deckId: 'deck-1',
        templateIndex: -1,
        state: 99, // invalid CardState
        due: Date.now(),
        fsrs: {
          stability: -1, // negative stability invalid
          difficulty: 15, // max is 10
          elapsed_days: 0,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
          state: 0,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      };

      const result = cardSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
    });
  });

  describe('Note Schema', () => {
    it('should validate a note with field values and tags', () => {
      const validNote = {
        id: 'note-123',
        noteTypeId: 'nt-1',
        fieldValues: {
          Front: 'What is mitochondria?',
          Back: 'The powerhouse of the cell.',
        },
        tags: ['biology', 'science'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      };

      const result = noteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should reject a note with empty ID', () => {
      const invalidNote = {
        id: '',
        noteTypeId: 'nt-1',
        fieldValues: {},
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      };

      const result = noteSchema.safeParse(invalidNote);
      expect(result.success).toBe(false);
    });
  });

  describe('Deck Schema', () => {
    it('should validate a standard deck with settings', () => {
      const validDeck = {
        id: 'deck-1',
        name: 'Languages::German',
        parentId: null,
        description: 'German vocabulary',
        settings: {
          newCardsPerDay: 25,
          maxReviewsPerDay: 150,
          desiredRetention: 0.9,
          learningSteps: [1, 10],
          relearningSteps: [10],
        },
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      };

      const result = deckSchema.safeParse(validDeck);
      expect(result.success).toBe(true);
    });
  });

  describe('NoteType Schema', () => {
    it('should validate a valid NoteType with template formatting', () => {
      const validNoteType = {
        id: 'nt-basic',
        name: 'Basic',
        isCloze: false,
        fields: [
          { id: 'f1', name: 'Front', description: 'Front of card' },
          { id: 'f2', name: 'Back', description: 'Back of card' },
        ],
        templates: [
          {
            name: 'Card 1',
            qfmt: '{{Front}}',
            afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
          },
        ],
        css: '.card { font-size: 20px; }',
        updatedAt: Date.now(),
        deletedAt: null,
      };

      const result = noteTypeSchema.safeParse(validNoteType);
      expect(result.success).toBe(true);
    });
  });

  describe('ReviewLog Schema', () => {
    it('should validate review records with correct ratings and durations', () => {
      const validReview = {
        id: 'rev-1',
        cardId: 'card-1',
        rating: Rating.Good,
        state: CardState.Review,
        due: Date.now() + 86400000,
        stability: 3.2,
        difficulty: 4.8,
        elapsedDays: 1,
        lastElapsedDays: 0,
        scheduledDays: 3,
        reviewTime: Date.now(),
        durationMs: 4200,
        deletedAt: null,
      };

      const result = reviewLogSchema.safeParse(validReview);
      expect(result.success).toBe(true);
    });
  });

  describe('Media Schema', () => {
    it('should validate media items with binary data', () => {
      const validMedia = {
        filename: 'test-image.png',
        mimeType: 'image/png',
        data: new Blob(['fake-image-bytes'], { type: 'image/png' }),
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        size: 16,
        updatedAt: Date.now(),
        deletedAt: null,
      };

      const result = mediaItemSchema.safeParse(validMedia);
      expect(result.success).toBe(true);
    });
  });
});
