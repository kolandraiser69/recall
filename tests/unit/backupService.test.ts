import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { RecallDatabase } from '../../src/db/database';
import { BackupService } from '../../src/services/backupService';
import { CardState } from '../../src/core/models/card';

describe('BackupService Tests', () => {
  const dbName = `TestBackupDB_${Date.now()}_${Math.random()}`;
  let testDb: RecallDatabase;
  let backupService: BackupService;

  beforeEach(async () => {
    testDb = new RecallDatabase(dbName);
    await testDb.initialize();
    backupService = new BackupService(testDb);
  });

  afterEach(async () => {
    await testDb.close();
    await Dexie.delete(dbName);
  });

  it('should export database to a valid recall backup payload', async () => {
    const now = Date.now();

    await testDb.decks.add({
      id: 'd-1',
      name: 'Neuroscience',
      parentId: null,
      description: 'Brain anatomy',
      settings: {
        newCardsPerDay: 20,
        maxReviewsPerDay: 200,
        desiredRetention: 0.9,
        learningSteps: [1, 10],
        relearningSteps: [10],
      },
      order: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await testDb.cards.add({
      id: 'c-1',
      noteId: 'n-1',
      deckId: 'd-1',
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
    });

    const { payload, jsonString, filename } = await backupService.createBackup();

    expect(payload.format).toBe('recall_backup');
    expect(payload.version).toBe(1);
    expect(filename).toMatch(/recall_backup_\d{4}-\d{2}-\d{2}\.json/);
    expect(payload.metadata.deckCount).toBe(1);
    expect(payload.metadata.cardCount).toBe(1);
    expect(payload.decks.length).toBe(1);
    expect(payload.cards.length).toBe(1);

    const parsed = await backupService.parseAndValidateBackup(jsonString);
    expect(parsed.decks[0]?.id).toBe('d-1');
  });

  it('should restore database in replace mode and clear previous state', async () => {
    const now = Date.now();

    // Populate initial state
    await testDb.decks.add({
      id: 'old-deck',
      name: 'Old Deck',
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
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    // Create target backup to restore
    const backupPayload = {
      format: 'recall_backup' as const,
      version: 1 as const,
      createdAt: now,
      metadata: {
        appVersion: '0.1.0',
        deckCount: 1,
        noteCount: 0,
        cardCount: 0,
        reviewCount: 0,
        mediaCount: 0,
      },
      settings: {
        desiredRetention: 0.85,
        newCardsPerDay: 30,
        maxReviewsPerDay: 300,
        learningSteps: [1, 5],
        relearningSteps: [5],
        dayCutoffHour: 5,
        autoRevealAnswer: false,
        showTimer: true,
        language: 'en' as const,
        theme: 'dark' as const,
        compactDensity: false,
        reducedMotion: false,
        confirmDestructive: true,
      },
      decks: [
        {
          id: 'new-restored-deck',
          name: 'Restored Chemistry',
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
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ],
      noteTypes: [],
      notes: [],
      cards: [],
      reviews: [],
      media: [],
    };

    const result = await backupService.restoreBackup(backupPayload, 'replace');
    expect(result.decksRestored).toBe(1);

    const decksAfter = await testDb.decks.toArray();
    expect(decksAfter.length).toBe(1);
    expect(decksAfter[0]?.id).toBe('new-restored-deck');
    expect(decksAfter.find((d) => d.id === 'old-deck')).toBeUndefined();
  });

  it('should reset all database tables and recreate default note types on factoryReset', async () => {
    const now = Date.now();

    await testDb.decks.add({
      id: 'deck-to-wipe',
      name: 'To be wiped',
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
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await backupService.factoryReset();

    const decks = await testDb.decks.toArray();
    expect(decks.length).toBe(0);

    const noteTypes = await testDb.noteTypes.toArray();
    expect(noteTypes.length).toBeGreaterThan(0);
    const basicType = noteTypes.find((nt) => nt.id === 'default-basic');
    expect(basicType).toBeDefined();
    expect(basicType?.name).toBe('Basic');
  });
});
