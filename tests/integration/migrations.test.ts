import { describe, it, expect, afterEach } from 'vitest';
import Dexie from 'dexie';
import { RecallDatabase } from '../../src/db/database';
import { createRepositories } from '../../src/db/repositories';
import { SCHEMA_V1 } from '../../src/db/migrations/v1';
import { CardState, Rating } from '../../src/core/models/card';

describe('Migration & Schema Upgrade Integrity', () => {
  const dbName = `TestMigrationDB_${Date.now()}_${Math.random()}`;

  afterEach(async () => {
    await Dexie.delete(dbName);
  });

  it('should seed default NoteTypes idempotently on creation and not duplicate on reopen', async () => {
    // First open: DB creation
    const db1 = new RecallDatabase(dbName);
    await db1.initialize();
    const initialNoteTypes = await db1.noteTypes.toArray();
    expect(initialNoteTypes.length).toBe(3);
    db1.close();

    // Second open: Existing DB
    const db2 = new RecallDatabase(dbName);
    await db2.initialize();
    const reopenedNoteTypes = await db2.noteTypes.toArray();
    expect(reopenedNoteTypes.length).toBe(3);
    db2.close();
  });

  it('should preserve all data across a schema version upgrade (v1 to v2)', async () => {
    // 1. Initialize pure v1 database and populate data
    class PureDatabaseV1 extends Dexie {
      constructor(name: string) {
        super(name);
        this.version(1).stores(SCHEMA_V1);
      }
    }

    const dbV1 = new PureDatabaseV1(dbName);
    await dbV1.open();

    const now = Date.now();
    const deck = {
      id: 'd-v1-test',
      name: 'V1 Upgrade Test Deck',
      description: 'Original V1 description',
      parentId: null,
      order: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await dbV1.table('decks').add(deck);

    const note = {
      id: 'n-v1-test',
      deckId: deck.id,
      noteTypeId: 'default-basic',
      fieldValues: { Front: 'Test Question', Back: 'Test Answer' },
      tags: ['v1-tag'],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await dbV1.table('notes').add(note);

    const card = {
      id: 'c-v1-test',
      noteId: note.id,
      deckId: deck.id,
      templateIndex: 0,
      state: CardState.New,
      due: now,
      fsrs: {
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: CardState.New,
      },
      isSuspended: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await dbV1.table('cards').add(card);

    const review = {
      id: 'r-v1-test',
      cardId: card.id,
      rating: Rating.Good,
      reviewTime: now,
      durationMs: 1200,
      scheduledDays: 1,
      elapsedDays: 0,
      lastElapsedDays: 0,
      state: CardState.Review,
      fsrs: {
        stability: 2.0,
        difficulty: 5.0,
        due: now + 86400000,
      },
      createdAt: now,
      deletedAt: null,
    };
    await dbV1.table('reviews').add(review);

    const media = {
      filename: 'v1-diagram.png',
      mimeType: 'image/png',
      data: new Blob(['v1-binary-payload'], { type: 'image/png' }),
      hash: 'v1-hash',
      size: 17,
      updatedAt: now,
      deletedAt: null,
    };
    await dbV1.table('media').add(media);

    dbV1.close();

    // 2. Open with RecallDatabase V2
    const dbV2 = new RecallDatabase(dbName);
    await dbV2.initialize();

    // 3. Verify all existing V1 data survived without loss
    const decksV2 = await dbV2.decks.toArray();
    expect(decksV2.length).toBe(1);
    expect(decksV2[0]!.id).toBe(deck.id);
    expect(decksV2[0]!.name).toBe('V1 Upgrade Test Deck');
    expect(decksV2[0]!.description).toBe('Original V1 description');

    const notesV2 = await dbV2.notes.toArray();
    expect(notesV2.length).toBe(1);
    expect(notesV2[0]!.id).toBe(note.id);
    expect(notesV2[0]!.fieldValues.Front).toBe('Test Question');

    const cardsV2 = await dbV2.cards.toArray();
    expect(cardsV2.length).toBe(1);
    expect(cardsV2[0]!.id).toBe(card.id);

    const reviewsV2 = await dbV2.reviews.toArray();
    expect(reviewsV2.length).toBe(1);
    expect(reviewsV2[0]!.id).toBe(review.id);

    const mediaV2 = await dbV2.media.toArray();
    expect(mediaV2.length).toBe(1);
    expect(mediaV2[0]!.filename).toBe(media.filename);

    // 4. Verify V2 tables were populated during upgrade
    const categoriesV2 = await dbV2.calendarCategories.toArray();
    expect(categoriesV2.length).toBeGreaterThanOrEqual(4);

    const quicklinksV2 = await dbV2.quicklinks.toArray();
    expect(quicklinksV2.length).toBeGreaterThanOrEqual(11);

    dbV2.close();
  });

  it('should utilize [cardId+reviewTime] compound index for chronological queries', async () => {
    const db = new RecallDatabase(dbName);
    await db.initialize();
    const repos = createRepositories(db);

    const cardId = 'card-index-test';
    const now = Date.now();

    await repos.reviews.create({
      cardId,
      rating: Rating.Again,
      state: CardState.Learning,
      due: now,
      stability: 1,
      difficulty: 6,
      elapsedDays: 0,
      lastElapsedDays: 0,
      scheduledDays: 0,
      reviewTime: now - 10000,
    });

    await repos.reviews.create({
      cardId,
      rating: Rating.Good,
      state: CardState.Review,
      due: now + 86400000,
      stability: 3,
      difficulty: 5,
      elapsedDays: 1,
      lastElapsedDays: 0,
      scheduledDays: 1,
      reviewTime: now,
    });

    const reviews = await repos.reviews.getByCardId(cardId);
    expect(reviews.length).toBe(2);
    expect(reviews[0]?.reviewTime).toBeDefined();
    expect(reviews[1]?.reviewTime).toBeDefined();
    expect(reviews[0]!.reviewTime).toBeLessThan(reviews[1]!.reviewTime);

    const latest = await repos.reviews.getLatestForCard(cardId);
    expect(latest?.reviewTime).toBe(now);

    db.close();
  });

  it('should cache and reuse Object URLs in MediaRepository to prevent memory leaks', async () => {
    const db = new RecallDatabase(dbName);
    await db.initialize();
    const repos = createRepositories(db);

    const filename = 'diagram.svg';
    await repos.media.save({
      filename,
      mimeType: 'image/svg+xml',
      data: new Blob(['<svg></svg>'], { type: 'image/svg+xml' }),
    });

    // Mock URL.createObjectURL and URL.revokeObjectURL
    let createCount = 0;
    let revokeCount = 0;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    URL.createObjectURL = () => {
      createCount++;
      return `blob:http://localhost/mock-${createCount}`;
    };
    URL.revokeObjectURL = () => {
      revokeCount++;
    };

    try {
      // First call produces URL
      const url1 = await repos.media.getOrCreateBlobUrl(filename);
      expect(url1).toBe('blob:http://localhost/mock-1');
      expect(repos.media.getActiveUrlCount()).toBe(1);

      // Second call reuses cached URL without re-creating
      const url2 = await repos.media.getOrCreateBlobUrl(filename);
      expect(url2).toBe(url1);
      expect(createCount).toBe(1);

      // Revocation
      repos.media.revokeBlobUrl(filename);
      expect(revokeCount).toBe(1);
      expect(repos.media.getActiveUrlCount()).toBe(0);

      // Revoke all
      await repos.media.getOrCreateBlobUrl(filename);
      expect(repos.media.getActiveUrlCount()).toBe(1);
      repos.media.revokeAllBlobUrls();
      expect(repos.media.getActiveUrlCount()).toBe(0);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      db.close();
    }
  });
});
