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

  it('should preserve all data across a schema version upgrade (v1 to simulated v2)', async () => {
    // 1. Initialize v1 database and populate data
    const dbV1 = new RecallDatabase(dbName);
    await dbV1.initialize();
    const repos = createRepositories(dbV1);

    const deck = await repos.decks.create({ name: 'V1 Upgrade Test Deck' });
    const note = await repos.notes.create({
      noteTypeId: 'default-basic',
      fieldValues: { Front: 'Test Question', Back: 'Test Answer' },
      tags: ['v1-tag'],
    });
    const card = await repos.cards.create({
      noteId: note.id,
      deckId: deck.id,
      templateIndex: 0,
      state: CardState.New,
    });
    const review = await repos.reviews.create({
      cardId: card.id,
      rating: Rating.Good,
      state: CardState.Review,
      due: Date.now() + 86400000,
      stability: 2.0,
      difficulty: 5.0,
      elapsedDays: 0,
      lastElapsedDays: 0,
      scheduledDays: 1,
    });
    const media = await repos.media.save({
      filename: 'v1-diagram.png',
      mimeType: 'image/png',
      data: new Blob(['v1-binary-payload'], { type: 'image/png' }),
    });

    dbV1.close();

    // 2. Open with a simulated V2 database adding a new table and modifying indexes
    class TestDatabaseV2 extends Dexie {
      constructor(name: string) {
        super(name);
        this.version(1).stores(SCHEMA_V1);
        // Version 2 schema: adds a new 'userPreferences' table and an index
        this.version(2).stores({
          userPreferences: 'id, key, updatedAt',
        }).upgrade((tx) => {
          // Perform optional data migration transformation
          return tx.table('decks').toCollection().modify((d) => {
            d.description = d.description || 'Migrated from V1';
          });
        });
      }
    }

    const dbV2 = new TestDatabaseV2(dbName);
    await dbV2.open();

    // 3. Verify all existing V1 data survived without loss
    const decksV2 = await dbV2.table('decks').toArray();
    expect(decksV2.length).toBe(1);
    expect(decksV2[0].id).toBe(deck.id);
    expect(decksV2[0].description).toBe('Migrated from V1');

    const notesV2 = await dbV2.table('notes').toArray();
    expect(notesV2.length).toBe(1);
    expect(notesV2[0].id).toBe(note.id);
    expect(notesV2[0].fieldValues.Front).toBe('Test Question');

    const cardsV2 = await dbV2.table('cards').toArray();
    expect(cardsV2.length).toBe(1);
    expect(cardsV2[0].id).toBe(card.id);

    const reviewsV2 = await dbV2.table('reviews').toArray();
    expect(reviewsV2.length).toBe(1);
    expect(reviewsV2[0].id).toBe(review.id);

    const mediaV2 = await dbV2.table('media').toArray();
    expect(mediaV2.length).toBe(1);
    expect(mediaV2[0].filename).toBe(media.filename);

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
