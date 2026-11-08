import { describe, it, expect, beforeEach } from 'vitest';
import { studySessionService } from '../../src/services/studySessionService';
import { cardService } from '../../src/services/cardService';
import { db } from '../../src/db/database';
import { DEFAULT_NOTE_TYPES } from '../../src/db/migrations/v1';
import { DEFAULT_DECK_SETTINGS } from '../../src/core/models/deck';
import { CardState, Rating } from '../../src/core/models/card';

describe('StudySessionService (Session Engine & Review Processing)', () => {
  beforeEach(async () => {
    await db.initialize();
    await db.notes.clear();
    await db.cards.clear();
    await db.decks.clear();
    await db.reviews.clear();

    const count = await db.noteTypes.count();
    if (count === 0) {
      await db.noteTypes.bulkAdd(DEFAULT_NOTE_TYPES);
    }

    // Seed test deck
    await db.decks.add({
      id: 'deck-main',
      name: 'Main Deck',
      parentId: null,
      description: 'Main study deck',
      settings: {
        ...DEFAULT_DECK_SETTINGS,
        newCardsPerDay: 5,
        maxReviewsPerDay: 10,
      },
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    });
  });

  it('detects empty session when deck has no cards', async () => {
    const session = await studySessionService.startSession({ deckId: 'deck-main' });
    expect(session.emptyReason).toBe('no_cards');
    expect(session.isCompleted).toBe(true);
    expect(session.currentCardItem).toBeNull();
  });

  it('detects empty session when all cards in deck are suspended', async () => {
    const { cards } = await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-main',
      fieldValues: { Front: 'Front 1', Back: 'Back 1' },
    });

    await cardService.setCardSuspended(cards[0]!.id, true);

    const session = await studySessionService.startSession({ deckId: 'deck-main' });
    expect(session.emptyReason).toBe('all_suspended');
    expect(session.isCompleted).toBe(true);
  });

  it('loads new cards up to daily limit', async () => {
    // Create 7 new notes (7 cards)
    for (let i = 1; i <= 7; i++) {
      await cardService.createNoteWithCards({
        noteTypeId: 'default-basic',
        deckId: 'deck-main',
        fieldValues: { Front: `Front ${i}`, Back: `Back ${i}` },
      });
    }

    // Daily limit is 5
    const session = await studySessionService.startSession({ deckId: 'deck-main' });
    expect(session.emptyReason).toBe('none');
    expect(session.isCompleted).toBe(false);
    expect(session.initialTotal).toBe(5);
    expect(session.currentCardItem).toBeDefined();
    expect(session.queue.length).toBe(4);
  });

  it('processes review submission atomically and advances queue', async () => {
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-main',
      fieldValues: { Front: 'Front 1', Back: 'Back 1' },
    });
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-main',
      fieldValues: { Front: 'Front 2', Back: 'Back 2' },
    });

    const session = await studySessionService.startSession({ deckId: 'deck-main' });
    expect(session.queue.length).toBe(1);
    const initialCardId = session.currentCardItem!.card.id;

    // Submit Good rating
    const { session: nextSession, reviewLog } = await studySessionService.submitReview(
      session,
      Rating.Good,
      1200
    );

    // Verify database state
    const savedCard = await db.cards.get(initialCardId);
    expect(savedCard?.state).toBe(CardState.Learning);
    expect(savedCard?.fsrs.reps).toBe(1);

    const savedLog = await db.reviews.get(reviewLog.id);
    expect(savedLog).toBeDefined();
    expect(savedLog?.rating).toBe(Rating.Good);
    expect(savedLog?.durationMs).toBe(1200);

    // Verify session progress
    expect(nextSession.stats.cardsAnswered).toBe(1);
    expect(nextSession.stats.newCardsStudied).toBe(1);
    expect(nextSession.currentCardItem?.card.id).not.toBe(initialCardId);
    expect(nextSession.isCompleted).toBe(false);
  });

  it('re-enqueues card upon rating Again in active session', async () => {
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-main',
      fieldValues: { Front: 'Card 1', Back: 'Back 1' },
    });
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-main',
      fieldValues: { Front: 'Card 2', Back: 'Back 2' },
    });

    const session = await studySessionService.startSession({ deckId: 'deck-main' });
    const firstCardId = session.currentCardItem!.card.id;

    // Rate Again on first card
    const { session: afterAgain } = await studySessionService.submitReview(session, Rating.Again, 1000);

    // The first card should be re-inserted into the queue
    expect(afterAgain.queue.some((item) => item.card.id === firstCardId)).toBe(true);
  });

  it('reverts rating cleanly via undoLastReview', async () => {
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-main',
      fieldValues: { Front: 'Undo Test', Back: 'Undo Back' },
    });

    const session = await studySessionService.startSession({ deckId: 'deck-main' });
    const originalCard = session.currentCardItem!.card;

    const { session: ratedSession, reviewLog } = await studySessionService.submitReview(
      session,
      Rating.Easy,
      1500
    );

    expect(ratedSession.isCompleted).toBe(true);
    expect(ratedSession.stats.cardsAnswered).toBe(1);

    // Perform Undo
    const undoneSession = await studySessionService.undoLastReview(ratedSession);

    expect(undoneSession.isCompleted).toBe(false);
    expect(undoneSession.stats.cardsAnswered).toBe(0);
    expect(undoneSession.currentCardItem?.card.id).toBe(originalCard.id);

    // Check DB card state restored
    const dbCard = await db.cards.get(originalCard.id);
    expect(dbCard?.state).toBe(originalCard.state);
    expect(dbCard?.fsrs.reps).toBe(originalCard.fsrs.reps);

    // ReviewLog is soft-tombstoned (deletedAt not null)
    const dbLog = await db.reviews.get(reviewLog.id);
    expect(dbLog?.deletedAt).not.toBeNull();
  });
});
