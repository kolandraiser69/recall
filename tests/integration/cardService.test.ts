import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { RecallDatabase } from '../../src/db/database';
import { CardService } from '../../src/services/cardService';
import { CardState, Rating } from '../../src/core/models/card';

describe('CardService Integration', () => {
  const dbName = `TestCardServiceDB_${Date.now()}_${Math.random()}`;
  let testDb: RecallDatabase;
  let cardService: CardService;
  let deckId: string;

  beforeEach(async () => {
    testDb = new RecallDatabase(dbName);
    await testDb.initialize();
    cardService = new CardService(testDb);

    // Create a default deck
    const deck = await testDb.decks.add({
      id: 'test-deck-1',
      name: 'Biology',
      parentId: null,
      description: 'Test deck',
      settings: {
        newCardsPerDay: 20,
        maxReviewsPerDay: 200,
        desiredRetention: 0.9,
        learningSteps: [1, 10],
        relearningSteps: [10],
      },
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    });
    deckId = deck;
  });

  afterEach(async () => {
    await testDb.close();
    await Dexie.delete(dbName);
  });

  it('should atomically create a note and all its cards', async () => {
    const { note, cards } = await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId,
      fieldValues: {
        Front: 'What does DNA stand for?',
        Back: 'Deoxyribonucleic acid',
      },
      tags: ['genetics', 'biology'],
    });

    expect(note.id).toBeDefined();
    expect(cards.length).toBe(1);
    expect(cards[0]?.noteId).toBe(note.id);
    expect(cards[0]?.deckId).toBe(deckId);

    // Verify in database tables
    const dbNote = await testDb.notes.get(note.id);
    expect(dbNote).toBeDefined();
    const dbCards = await testDb.cards.where('noteId').equals(note.id).toArray();
    expect(dbCards.length).toBe(1);
  });

  it('should preserve card ID, deck assignment, and FSRS state on sync', async () => {
    // 1. Create a reversed note (produces 2 cards)
    const { note, cards } = await cardService.createNoteWithCards({
      noteTypeId: 'default-reversed',
      deckId,
      fieldValues: {
        Front: 'dog',
        Back: 'Hund',
      },
    });

    expect(cards.length).toBe(2);
    const card0 = cards.find((c) => c.templateIndex === 0)!;
    const card1 = cards.find((c) => c.templateIndex === 1)!;
    expect(card1.templateIndex).toBe(1);

    // 2. Simulate learning progress (FSRS mutation & ReviewLog) on card 0
    await testDb.cards.update(card0.id, {
      state: CardState.Review,
      'fsrs.stability': 8.5,
      'fsrs.reps': 3,
      due: Date.now() + 86400000,
    });

    await testDb.reviews.add({
      id: 'rev-1',
      cardId: card0.id,
      rating: Rating.Good,
      state: CardState.Review,
      due: Date.now() + 86400000,
      stability: 8.5,
      difficulty: 4.5,
      elapsedDays: 1,
      lastElapsedDays: 0,
      scheduledDays: 4,
      reviewTime: Date.now(),
      durationMs: 3200,
      deletedAt: null,
    });

    // 3. User updates note fields (e.g. fixed a typo in German word)
    const { cards: syncedCards } = await cardService.updateNoteAndSync(note.id, {
      fieldValues: {
        Front: 'dog',
        Back: 'der Hund (canine)',
      },
    });

    expect(syncedCards.length).toBe(2);

    // 4. Verify card0 retained exact same ID and FSRS state!
    const updatedCard0 = await testDb.cards.get(card0.id);
    expect(updatedCard0?.id).toBe(card0.id);
    expect(updatedCard0?.state).toBe(CardState.Review);
    expect(updatedCard0?.fsrs.stability).toBe(8.5);
    expect(updatedCard0?.fsrs.reps).toBe(3);

    // 5. Verify review log was NEVER touched or deleted
    const reviews = await testDb.reviews.where('cardId').equals(card0.id).toArray();
    expect(reviews.length).toBe(1);
    expect(reviews[0]?.id).toBe('rev-1');
  });

  it('should soft-delete obsolete cards when cloze deletions are removed without resetting remaining cards', async () => {
    // 1. Create a cloze note with c1, c2, c3 (generates 3 cards)
    const { note, cards } = await cardService.createNoteWithCards({
      noteTypeId: 'default-cloze',
      deckId,
      fieldValues: {
        Text: '{{c1::A}} and {{c2::B}} and {{c3::C}}',
        'Back Extra': '',
      },
    });

    expect(cards.length).toBe(3);

    // 2. User edits note to remove c3: only c1 and c2 remain
    const { cards: updatedCards } = await cardService.updateNoteAndSync(note.id, {
      fieldValues: {
        Text: '{{c1::A}} and {{c2::B}}',
        'Back Extra': '',
      },
    });

    // Active cards should now be 2
    expect(updatedCards.length).toBe(2);

    // Check database directly: 2 active cards, 1 soft-deleted card with deletedAt != null
    const allDbCards = await testDb.cards.where('noteId').equals(note.id).toArray();
    expect(allDbCards.length).toBe(3);

    const activeCards = allDbCards.filter((c) => c.deletedAt === null);
    const deletedCards = allDbCards.filter((c) => c.deletedAt !== null);

    expect(activeCards.length).toBe(2);
    expect(deletedCards.length).toBe(1);
    expect(deletedCards[0]?.templateIndex).toBe(2); // c3 (index 2) was soft-deleted
  });

  it('should rollback transaction completely if an error occurs during note creation', async () => {
    // Attempt to create a note with an invalid noteTypeId
    await expect(
      cardService.createNoteWithCards({
        noteTypeId: 'invalid-non-existent-type',
        deckId,
        fieldValues: { Front: 'Test' },
      })
    ).rejects.toThrow();

    // Verify database remains untouched (no orphaned notes or cards)
    const notesCount = await testDb.notes.count();
    const cardsCount = await testDb.cards.count();
    expect(notesCount).toBe(0);
    expect(cardsCount).toBe(0);
  });
});
