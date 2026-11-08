import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecallDatabase } from '../../src/db/database';
import { createRepositories, type Repositories } from '../../src/db/repositories';
import { CardState, Rating } from '../../src/core/models/card';

describe('Repositories Integration Tests', () => {
  let testDb: RecallDatabase;
  let repos: Repositories;

  beforeEach(async () => {
    testDb = new RecallDatabase(`TestReposDB_${Date.now()}_${Math.random()}`);
    await testDb.initialize();
    repos = createRepositories(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('DeckRepository', () => {
    it('should create and retrieve a deck', async () => {
      const deck = await repos.decks.create({
        name: 'Languages',
        description: 'All language decks',
      });

      expect(deck.id).toBeDefined();
      expect(deck.name).toBe('Languages');
      expect(deck.settings.desiredRetention).toBe(0.9);

      const fetched = await repos.decks.getById(deck.id);
      expect(fetched?.name).toBe('Languages');
    });

    it('should support hierarchical nested decks via parentId', async () => {
      const parent = await repos.decks.create({ name: 'Computer Science' });
      const child1 = await repos.decks.create({ name: 'Algorithms', parentId: parent.id });
      const child2 = await repos.decks.create({ name: 'Networking', parentId: parent.id });

      expect(child1.parentId).toBe(parent.id);
      expect(child2.parentId).toBe(parent.id);

      const subdecks = await repos.decks.getSubdecks(parent.id);
      expect(subdecks.length).toBe(2);
      expect(subdecks.map((s) => s.name)).toEqual(expect.arrayContaining(['Algorithms', 'Networking']));
    });

    it('should handle soft deletion with deletedAt timestamp', async () => {
      const deck = await repos.decks.create({ name: 'To Delete' });
      await repos.decks.delete(deck.id, false);

      const activeDecks = await repos.decks.getAll(false);
      expect(activeDecks.find((d) => d.id === deck.id)).toBeUndefined();

      const allDecks = await repos.decks.getAll(true);
      expect(allDecks.find((d) => d.id === deck.id)?.deletedAt).not.toBeNull();
    });
  });

  describe('NoteTypeRepository', () => {
    it('should retrieve seeded NoteTypes and allow creating custom NoteTypes', async () => {
      const existing = await repos.noteTypes.getAll();
      expect(existing.length).toBeGreaterThanOrEqual(3);

      const custom = await repos.noteTypes.create({
        name: 'Vocabulary with Audio',
        fields: [
          { id: 'f1', name: 'Word' },
          { id: 'f2', name: 'Meaning' },
          { id: 'f3', name: 'Audio' },
        ],
        templates: [
          { name: 'Listening', qfmt: '{{Audio}}', afmt: '{{Word}}\n{{Meaning}}' },
        ],
        css: '.word { font-weight: bold; }',
      });

      expect(custom.id).toBeDefined();
      const fetched = await repos.noteTypes.getById(custom.id);
      expect(fetched?.name).toBe('Vocabulary with Audio');
      expect(fetched?.fields.length).toBe(3);
    });
  });

  describe('NoteRepository', () => {
    it('should create notes with tags and custom fields', async () => {
      const note = await repos.notes.create({
        noteTypeId: 'default-basic',
        fieldValues: {
          Front: 'Capital of France?',
          Back: 'Paris',
        },
        tags: ['geography', 'europe'],
      });

      expect(note.id).toBeDefined();
      expect(note.fieldValues['Front']).toBe('Capital of France?');
      expect(note.tags).toContain('geography');

      const byType = await repos.notes.getByNoteType('default-basic');
      expect(byType.some((n) => n.id === note.id)).toBe(true);
    });
  });

  describe('CardRepository', () => {
    it('should create cards and query due cards efficiently via compound index', async () => {
      const deck = await repos.decks.create({ name: 'Test Due Deck' });
      const now = Date.now();

      // Card 1: Due in the past (due now)
      const dueCard = await repos.cards.create({
        noteId: 'n1',
        deckId: deck.id,
        templateIndex: 0,
        due: now - 3600000, // 1 hour ago
        state: CardState.Review,
      });

      // Card 2: Due tomorrow
      await repos.cards.create({
        noteId: 'n2',
        deckId: deck.id,
        templateIndex: 0,
        due: now + 86400000, // 1 day in future
        state: CardState.Review,
      });

      const dueCards = await repos.cards.getDueCards(deck.id, now);
      expect(dueCards.length).toBe(1);
      expect(dueCards[0]?.id).toBe(dueCard.id);
    });

    it('should support cascading soft deletion of all cards associated with a note', async () => {
      const deck = await repos.decks.create({ name: 'Cascade Deck' });
      const noteId = 'parent-note-id';

      await repos.cards.create({ noteId, deckId: deck.id, templateIndex: 0 });
      await repos.cards.create({ noteId, deckId: deck.id, templateIndex: 1 });

      const initialCards = await repos.cards.getByNoteId(noteId, false);
      expect(initialCards.length).toBe(2);

      await repos.cards.deleteByNoteId(noteId, false);

      const activeCards = await repos.cards.getByNoteId(noteId, false);
      expect(activeCards.length).toBe(0);

      const allCards = await repos.cards.getByNoteId(noteId, true);
      expect(allCards.length).toBe(2);
      expect(allCards[0]?.deletedAt).not.toBeNull();
    });
  });

  describe('ReviewRepository', () => {
    it('should record review history and retrieve logs in chronological order', async () => {
      const cardId = 'card-review-test';
      const t1 = 1000;
      const t2 = 2000;

      await repos.reviews.create({
        cardId,
        rating: Rating.Again,
        state: CardState.Learning,
        due: t1 + 60000,
        stability: 1.0,
        difficulty: 6.0,
        elapsedDays: 0,
        lastElapsedDays: 0,
        scheduledDays: 0,
        reviewTime: t1,
        durationMs: 3000,
      });

      await repos.reviews.create({
        cardId,
        rating: Rating.Good,
        state: CardState.Review,
        due: t2 + 86400000,
        stability: 2.5,
        difficulty: 5.5,
        elapsedDays: 1,
        lastElapsedDays: 0,
        scheduledDays: 1,
        reviewTime: t2,
        durationMs: 2500,
      });

      const history = await repos.reviews.getByCardId(cardId);
      expect(history.length).toBe(2);
      expect(history[0]?.rating).toBe(Rating.Again);
      expect(history[1]?.rating).toBe(Rating.Good);

      const latest = await repos.reviews.getLatestForCard(cardId);
      expect(latest?.reviewTime).toBe(t2);
      expect(latest?.rating).toBe(Rating.Good);
    });
  });

  describe('MediaRepository', () => {
    it('should store binary Blobs, compute SHA-256 hashes, and deduplicate', async () => {
      const blob = new Blob(['binary-sound-sample-content'], { type: 'audio/mp3' });
      const filename = 'audio-1.mp3';

      const saved = await repos.media.save({
        filename,
        mimeType: 'audio/mp3',
        data: blob,
      });

      expect(saved.filename).toBe(filename);
      expect(saved.hash).toBeDefined();
      expect(saved.size).toBe(blob.size);

      const byHash = await repos.media.getByHash(saved.hash);
      expect(byHash?.filename).toBe(filename);
    });
  });
});
