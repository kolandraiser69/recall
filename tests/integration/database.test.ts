import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecallDatabase } from '../../src/db/database';
import { DEFAULT_NOTE_TYPES } from '../../src/db/migrations/v1';

describe('RecallDatabase Integration', () => {
  let testDb: RecallDatabase;

  beforeEach(async () => {
    testDb = new RecallDatabase(`TestRecallDB_${Date.now()}_${Math.random()}`);
    await testDb.initialize();
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('should initialize and open Dexie successfully', () => {
    expect(testDb.isOpen()).toBe(true);
    expect(testDb.tables.length).toBeGreaterThan(0);
  });

  it('should automatically seed default NoteTypes on database creation', async () => {
    const noteTypes = await testDb.noteTypes.toArray();
    expect(noteTypes.length).toBe(DEFAULT_NOTE_TYPES.length);

    const basic = noteTypes.find((nt) => nt.id === 'default-basic');
    expect(basic).toBeDefined();
    expect(basic?.name).toBe('Basic');
    expect(basic?.templates.length).toBe(1);

    const cloze = noteTypes.find((nt) => nt.id === 'default-cloze');
    expect(cloze).toBeDefined();
    expect(cloze?.isCloze).toBe(true);
  });

  it('should clear all tables atomically via clearAllTables()', async () => {
    // Add a deck
    await testDb.decks.add({
      id: 'd1',
      name: 'Temp Deck',
      parentId: null,
      description: '',
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

    expect(await testDb.decks.count()).toBe(1);

    await testDb.clearAllTables();

    expect(await testDb.decks.count()).toBe(0);
    expect(await testDb.noteTypes.count()).toBe(0);
  });
});
