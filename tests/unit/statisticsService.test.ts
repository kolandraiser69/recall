import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { RecallDatabase } from '../../src/db/database';
import { StatisticsService } from '../../src/services/statisticsService';
import { DeckService } from '../../src/services/deckService';
import { CardState, Rating } from '../../src/core/models/card';
import type { ReviewLog } from '../../src/core/models/review';

describe('StatisticsService Unit & Integration Tests', () => {
  const dbName = `TestStatsDB_${Date.now()}_${Math.random()}`;
  let testDb: RecallDatabase;
  let statsService: StatisticsService;
  let deckService: DeckService;

  beforeEach(async () => {
    testDb = new RecallDatabase(dbName);
    await testDb.initialize();
    deckService = new DeckService(testDb);
    statsService = new StatisticsService(testDb, deckService);
  });

  afterEach(async () => {
    await testDb.close();
    await Dexie.delete(dbName);
  });

  it('should gracefully return zero stats on empty database without throwing', async () => {
    const today = await statsService.getTodayStats();
    expect(today.cardsAnswered).toBe(0);
    expect(today.reviewsCount).toBe(0);
    expect(today.timeSpentMs).toBe(0);
    expect(today.streakDays).toBe(0);
    expect(today.dueCards).toBe(0);
    expect(today.newCards).toBe(0);
    expect(today.ratings).toEqual({ again: 0, hard: 0, good: 0, easy: 0 });

    const overview = await statsService.getOverviewStats();
    expect(overview.totalCards).toBe(0);
    expect(overview.totalReviews).toBe(0);
    expect(overview.retentionRate).toBe(0);
    expect(overview.stateCounts.new).toBe(0);

    const history = await statsService.getReviewHistoryStats('7d');
    expect(history.totalReviews).toBe(0);
    expect(history.points.length).toBe(7);

    const heatmap = await statsService.getActivityHeatmapData();
    expect(heatmap.activeDaysCount).toBe(0);
    expect(heatmap.longestStreak).toBe(0);

    const fsrs = await statsService.getFSRSStats();
    expect(fsrs.averageStability).toBe(0);
    expect(fsrs.averageDifficulty).toBe(0);

    const deckStats = await statsService.getDeckStatistics();
    expect(deckStats).toEqual([]);
  });

  it('should calculate today stats and ratings breakdown accurately', async () => {
    const now = Date.now();

    // Create a deck
    await testDb.decks.add({
      id: 'deck-1',
      name: 'Languages',
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

    // Create a card
    await testDb.cards.add({
      id: 'card-1',
      noteId: 'note-1',
      deckId: 'deck-1',
      templateIndex: 0,
      state: CardState.Review,
      due: now - 1000,
      fsrs: {
        stability: 5.2,
        difficulty: 4.1,
        elapsed_days: 2,
        scheduled_days: 4,
        reps: 3,
        lapses: 0,
        state: CardState.Review,
        last_review: now,
      },
      isSuspended: false,
      createdAt: now - 100000,
      updatedAt: now,
      deletedAt: null,
    });

    // Add review logs for today
    const reviewLog1: ReviewLog = {
      id: 'rev-1',
      cardId: 'card-1',
      rating: Rating.Good,
      state: CardState.Review,
      due: now,
      stability: 5.2,
      difficulty: 4.1,
      elapsedDays: 2,
      lastElapsedDays: 1,
      scheduledDays: 4,
      durationMs: 4500,
      reviewTime: now - 3600000, // 1 hour ago
      deletedAt: null,
    };

    const reviewLog2: ReviewLog = {
      id: 'rev-2',
      cardId: 'card-1',
      rating: Rating.Again,
      state: CardState.Review,
      due: now,
      stability: 2.1,
      difficulty: 6.0,
      elapsedDays: 4,
      lastElapsedDays: 2,
      scheduledDays: 1,
      durationMs: 8200,
      reviewTime: now - 1800000, // 30 mins ago
      deletedAt: null,
    };

    // A soft-deleted review (undone, must be ignored)
    const undoneLog: ReviewLog = {
      id: 'rev-undone',
      cardId: 'card-1',
      rating: Rating.Easy,
      state: CardState.Review,
      due: now,
      stability: 10,
      difficulty: 3,
      elapsedDays: 1,
      lastElapsedDays: 0,
      scheduledDays: 10,
      durationMs: 2000,
      reviewTime: now,
      deletedAt: now,
    };

    await testDb.reviews.bulkAdd([reviewLog1, reviewLog2, undoneLog]);

    const today = await statsService.getTodayStats();
    expect(today.reviewsCount).toBe(2);
    expect(today.cardsAnswered).toBe(1); // Same card reviewed twice
    expect(today.timeSpentMs).toBe(4500 + 8200);
    expect(today.ratings.good).toBe(1);
    expect(today.ratings.again).toBe(1);
    expect(today.ratings.easy).toBe(0);
    expect(today.ratings.hard).toBe(0);
    expect(today.streakDays).toBe(1);
  });

  it('should compute overview metrics and state distributions', async () => {
    const now = Date.now();

    await testDb.cards.bulkAdd([
      {
        id: 'c-new',
        noteId: 'n1',
        deckId: 'd1',
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
      },
      {
        id: 'c-rev',
        noteId: 'n1',
        deckId: 'd1',
        templateIndex: 0,
        state: CardState.Review,
        due: now,
        fsrs: {
          stability: 12,
          difficulty: 4,
          elapsed_days: 10,
          scheduled_days: 25, // mature card
          reps: 5,
          lapses: 0,
          state: CardState.Review,
        },
        isSuspended: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: 'c-susp',
        noteId: 'n1',
        deckId: 'd1',
        templateIndex: 0,
        state: CardState.Review,
        due: now,
        fsrs: {
          stability: 2,
          difficulty: 7,
          elapsed_days: 1,
          scheduled_days: 1,
          reps: 2,
          lapses: 1,
          state: CardState.Review,
        },
        isSuspended: true, // suspended
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await testDb.reviews.bulkAdd([
      {
        id: 'r1',
        cardId: 'c-rev',
        rating: Rating.Good,
        state: CardState.Review,
        due: now,
        stability: 12,
        difficulty: 4,
        elapsedDays: 10,
        lastElapsedDays: 5,
        scheduledDays: 25,
        durationMs: 3000,
        reviewTime: now,
        deletedAt: null,
      },
    ]);

    const overview = await statsService.getOverviewStats();
    expect(overview.totalCards).toBe(3);
    expect(overview.stateCounts.new).toBe(1);
    expect(overview.stateCounts.review).toBe(1);
    expect(overview.stateCounts.suspended).toBe(1);
    expect(overview.retentionRate).toBe(100);
    expect(overview.matureRetentionRate).toBe(100);
  });

  it('should compute FSRS statistics and distributions', async () => {
    const now = Date.now();

    await testDb.cards.bulkAdd([
      {
        id: 'c1',
        noteId: 'n1',
        deckId: 'd1',
        templateIndex: 0,
        state: CardState.Review,
        due: now,
        fsrs: {
          stability: 10,
          difficulty: 3,
          elapsed_days: 5,
          scheduled_days: 10,
          reps: 3,
          lapses: 0,
          state: CardState.Review,
        },
        isSuspended: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: 'c2',
        noteId: 'n1',
        deckId: 'd1',
        templateIndex: 0,
        state: CardState.Review,
        due: now,
        fsrs: {
          stability: 20,
          difficulty: 5,
          elapsed_days: 10,
          scheduled_days: 20,
          reps: 4,
          lapses: 0,
          state: CardState.Review,
        },
        isSuspended: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    const fsrs = await statsService.getFSRSStats();
    expect(fsrs.averageStability).toBe(15);
    expect(fsrs.averageDifficulty).toBe(4);
    expect(fsrs.stabilityDistribution.from7dTo30d).toBe(2);
    expect(fsrs.difficultyDistribution.easy).toBe(1);
    expect(fsrs.difficultyDistribution.moderate).toBe(1);
  });
});
