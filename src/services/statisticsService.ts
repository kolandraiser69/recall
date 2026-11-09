import { db, type RecallDatabase } from '../db/database';
import { deckService, type DeckService } from './deckService';
import { settingsService } from './settingsService';
import { CardState, Rating } from '../core/models/card';
import type { ReviewLog } from '../core/models/review';
import type { Card } from '../core/models/card';

export type Timeframe = '7d' | '30d' | '90d' | '365d' | 'all';

export interface TodayStats {
  cardsAnswered: number;
  reviewsCount: number;
  timeSpentMs: number;
  dueCards: number;
  newCards: number;
  streakDays: number;
  ratings: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
}

export interface OverviewStats {
  totalCards: number;
  totalReviews: number;
  totalTimeSpentMs: number;
  dailyAverageReviews: number;
  retentionRate: number; // Percentage 0 - 100
  matureRetentionRate: number; // Scheduled days >= 21
  stateCounts: {
    new: number;
    learning: number;
    review: number;
    relearning: number;
    suspended: number;
  };
}

export interface DailyActivityPoint {
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "Mon, Nov 9"
  reviews: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  durationMs: number;
}

export interface ReviewHistoryStats {
  timeframe: Timeframe;
  totalReviews: number;
  dailyAverage: number;
  totalDurationMs: number;
  avgDurationSec: number;
  points: DailyActivityPoint[];
  ratings: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  durationMs: number;
}

export interface HeatmapStats {
  days: HeatmapDay[];
  currentStreak: number;
  longestStreak: number;
  activeDaysCount: number;
  totalReviews: number;
}

export interface DeckStatisticItem {
  id: string;
  name: string;
  parentId: string | null;
  directCards: number;
  totalCards: number;
  newCount: number;
  dueCount: number;
  suspendedCount: number;
  totalReviews: number;
  retentionRate: number;
  averageStability: number;
  averageDifficulty: number;
}

export interface FSRSStats {
  averageStability: number; // in days
  averageDifficulty: number; // 1 to 10
  desiredRetention: number; // from settings (e.g. 0.90)
  measuredRetention: number; // actual % of non-again reviews
  stabilityDistribution: {
    under1d: number;
    from1dTo7d: number;
    from7dTo30d: number;
    from30dTo90d: number;
    over90d: number;
  };
  difficultyDistribution: {
    easy: number; // 1 - 3.5
    moderate: number; // 3.5 - 6.5
    hard: number; // 6.5 - 8.5
    veryHard: number; // 8.5 - 10
  };
}

export class StatisticsService {
  constructor(
    private database: RecallDatabase = db,
    private deckSvc: DeckService = deckService
  ) {}

  /**
   * Calculates the Unix timestamp for the start of today, adjusted by rollover hour.
   */
  getStartOfDay(offsetHours = 4): number {
    const d = new Date();
    // If current hour is before the rollover cutoff, the study "day" started yesterday
    if (d.getHours() < offsetHours) {
      d.setDate(d.getDate() - 1);
    }
    d.setHours(offsetHours, 0, 0, 0);
    return d.getTime();
  }

  /**
   * Helper to format a Date into YYYY-MM-DD string.
   */
  formatDateKey(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Aggregates stats for the current study day (Home view & Quick Dash).
   */
  async getTodayStats(): Promise<TodayStats> {
    const settings = settingsService.getSettings();
    const startOfToday = this.getStartOfDay(settings.dayCutoffHour);
    const now = Date.now();

    // Query active cards and today's reviews
    const [todayReviews, allReviews, dueCards, newCards] = await Promise.all([
      this.database.reviews
        .filter((r) => r.deletedAt === null && r.reviewTime >= startOfToday)
        .toArray(),
      this.database.reviews
        .filter((r) => r.deletedAt === null)
        .toArray(),
      this.database.cards
        .filter((c) => c.deletedAt === null && !c.isSuspended && c.due <= now && c.state !== CardState.New)
        .count(),
      this.database.cards
        .filter((c) => c.deletedAt === null && !c.isSuspended && c.state === CardState.New)
        .count(),
    ]);

    // Unique cards answered today
    const uniqueCardIds = new Set(todayReviews.map((r) => r.cardId));
    let timeSpentMs = 0;
    const ratings = { again: 0, hard: 0, good: 0, easy: 0 };

    for (const r of todayReviews) {
      timeSpentMs += r.durationMs || 0;
      if (r.rating === Rating.Again) ratings.again++;
      else if (r.rating === Rating.Hard) ratings.hard++;
      else if (r.rating === Rating.Good) ratings.good++;
      else if (r.rating === Rating.Easy) ratings.easy++;
    }

    const streakDays = this.calculateStreak(allReviews, settings.dayCutoffHour);

    return {
      cardsAnswered: uniqueCardIds.size,
      reviewsCount: todayReviews.length,
      timeSpentMs,
      dueCards,
      newCards,
      streakDays,
      ratings,
    };
  }

  /**
   * Calculates overall collection metrics, state distributions, and retention rates.
   */
  async getOverviewStats(deckId?: string, includeSubdecks = true): Promise<OverviewStats> {
    let allowedDeckIds: Set<string> | null = null;
    if (deckId) {
      const ids = includeSubdecks
        ? await this.deckSvc.getSubdeckIds(deckId, true)
        : [deckId];
      allowedDeckIds = new Set(ids);
    }

    const [allCards, allReviews] = await Promise.all([
      this.database.cards.filter((c) => c.deletedAt === null).toArray(),
      this.database.reviews.filter((r) => r.deletedAt === null).toArray(),
    ]);

    // Filter by deck if specified
    const cards = allowedDeckIds
      ? allCards.filter((c) => allowedDeckIds.has(c.deckId))
      : allCards;

    const cardIdSet = new Set(cards.map((c) => c.id));
    const reviews = allowedDeckIds
      ? allReviews.filter((r) => cardIdSet.has(r.cardId))
      : allReviews;

    const stateCounts = {
      new: 0,
      learning: 0,
      review: 0,
      relearning: 0,
      suspended: 0,
    };

    for (const card of cards) {
      if (card.isSuspended) {
        stateCounts.suspended++;
      } else if (card.state === CardState.New) {
        stateCounts.new++;
      } else if (card.state === CardState.Learning) {
        stateCounts.learning++;
      } else if (card.state === CardState.Review) {
        stateCounts.review++;
      } else if (card.state === CardState.Relearning) {
        stateCounts.relearning++;
      }
    }

    let totalTimeSpentMs = 0;
    let successfulReviews = 0;
    let matureReviews = 0;
    let matureSuccesses = 0;
    const activeDates = new Set<string>();

    for (const r of reviews) {
      totalTimeSpentMs += r.durationMs || 0;
      activeDates.add(this.formatDateKey(r.reviewTime));

      const isSuccess = r.rating >= Rating.Hard; // Non-again ratings count as retained
      if (isSuccess) successfulReviews++;

      if (r.scheduledDays >= 21) {
        matureReviews++;
        if (isSuccess) matureSuccesses++;
      }
    }

    const retentionRate = reviews.length > 0 ? (successfulReviews / reviews.length) * 100 : 0;
    const matureRetentionRate = matureReviews > 0 ? (matureSuccesses / matureReviews) * 100 : retentionRate;

    const activeDays = Math.max(1, activeDates.size);
    const dailyAverageReviews = reviews.length > 0 ? Math.round((reviews.length / activeDays) * 10) / 10 : 0;

    return {
      totalCards: cards.length,
      totalReviews: reviews.length,
      totalTimeSpentMs,
      dailyAverageReviews,
      retentionRate: Math.round(retentionRate * 10) / 10,
      matureRetentionRate: Math.round(matureRetentionRate * 10) / 10,
      stateCounts,
    };
  }

  /**
   * Aggregates review logs over a specified timeframe for charts.
   */
  async getReviewHistoryStats(options?: {
    timeframe?: Timeframe;
    deckId?: string;
    includeSubdecks?: boolean;
  } | Timeframe): Promise<ReviewHistoryStats> {
    const opts = typeof options === 'string' ? { timeframe: options } : options;
    const timeframe = opts?.timeframe ?? '30d';
    const now = Date.now();
    const dayMs = 86400000;

    let startTime = 0;
    let daysToInclude = 30;

    if (timeframe === '7d') {
      daysToInclude = 7;
      startTime = now - 7 * dayMs;
    } else if (timeframe === '30d') {
      daysToInclude = 30;
      startTime = now - 30 * dayMs;
    } else if (timeframe === '90d') {
      daysToInclude = 90;
      startTime = now - 90 * dayMs;
    } else if (timeframe === '365d') {
      daysToInclude = 365;
      startTime = now - 365 * dayMs;
    } else {
      // 'all'
      daysToInclude = 60; // minimum template window
      startTime = 0;
    }

    // Deck filter
    let allowedCardIds: Set<string> | null = null;
    if (opts?.deckId) {
      const deckIds = opts.includeSubdecks !== false
        ? await this.deckSvc.getSubdeckIds(opts.deckId, true)
        : [opts.deckId];
      const targetDeckSet = new Set(deckIds);
      const cardsInDeck = await this.database.cards
        .filter((c) => c.deletedAt === null && targetDeckSet.has(c.deckId))
        .toArray();
      allowedCardIds = new Set(cardsInDeck.map((c) => c.id));
    }

    const reviews = await this.database.reviews
      .filter((r) => {
        if (r.deletedAt !== null) return false;
        if (r.reviewTime < startTime) return false;
        if (allowedCardIds && !allowedCardIds.has(r.cardId)) return false;
        return true;
      })
      .toArray();

    // Map reviews into daily buckets
    const pointsMap = new Map<string, DailyActivityPoint>();

    // Pre-populate points for the days so line/bar charts have continuous data
    const anchorDate = new Date();
    anchorDate.setHours(0, 0, 0, 0);

    for (let i = daysToInclude - 1; i >= 0; i--) {
      const cur = new Date(anchorDate.getTime() - i * dayMs);
      const key = this.formatDateKey(cur);
      const formatted = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(cur);

      pointsMap.set(key, {
        date: key,
        formattedDate: formatted,
        reviews: 0,
        again: 0,
        hard: 0,
        good: 0,
        easy: 0,
        durationMs: 0,
      });
    }

    let totalDurationMs = 0;
    const ratings = { again: 0, hard: 0, good: 0, easy: 0 };

    for (const r of reviews) {
      totalDurationMs += r.durationMs || 0;
      const key = this.formatDateKey(r.reviewTime);

      let point = pointsMap.get(key);
      if (!point) {
        point = {
          date: key,
          formattedDate: key,
          reviews: 0,
          again: 0,
          hard: 0,
          good: 0,
          easy: 0,
          durationMs: 0,
        };
        pointsMap.set(key, point);
      }

      point.reviews++;
      point.durationMs += r.durationMs || 0;

      if (r.rating === Rating.Again) {
        point.again++;
        ratings.again++;
      } else if (r.rating === Rating.Hard) {
        point.hard++;
        ratings.hard++;
      } else if (r.rating === Rating.Good) {
        point.good++;
        ratings.good++;
      } else if (r.rating === Rating.Easy) {
        point.easy++;
        ratings.easy++;
      }
    }

    // Sort points chronologically
    const points = Array.from(pointsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const totalReviews = reviews.length;
    const dailyAverage = points.length > 0 ? Math.round((totalReviews / points.length) * 10) / 10 : 0;
    const avgDurationSec = totalReviews > 0 ? Math.round((totalDurationMs / totalReviews) / 100) / 10 : 0;

    return {
      timeframe,
      totalReviews,
      dailyAverage,
      totalDurationMs,
      avgDurationSec,
      points,
      ratings,
    };
  }

  /**
   * Generates continuous daily review counts for the 365-day GitHub-style contribution heatmap.
   */
  async getActivityHeatmapData(days = 365): Promise<HeatmapStats> {
    const settings = settingsService.getSettings();
    const now = Date.now();
    const dayMs = 86400000;
    const startTime = now - days * dayMs;

    const allReviews = await this.database.reviews
      .filter((r) => r.deletedAt === null)
      .toArray();

    // Map counts and duration by date key
    const dateCounts = new Map<string, { count: number; durationMs: number }>();
    for (const r of allReviews) {
      if (r.reviewTime >= startTime) {
        const key = this.formatDateKey(r.reviewTime);
        const existing = dateCounts.get(key) || { count: 0, durationMs: 0 };
        existing.count++;
        existing.durationMs += r.durationMs || 0;
        dateCounts.set(key, existing);
      }
    }

    const heatmapDays: HeatmapDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activeDaysCount = 0;
    let totalReviews = 0;

    for (let i = days - 1; i >= 0; i--) {
      const cur = new Date(today.getTime() - i * dayMs);
      const key = this.formatDateKey(cur);
      const data = dateCounts.get(key) || { count: 0, durationMs: 0 };

      let intensity: 0 | 1 | 2 | 3 | 4 = 0;
      if (data.count > 0) {
        activeDaysCount++;
        totalReviews += data.count;
        if (data.count <= 5) intensity = 1;
        else if (data.count <= 15) intensity = 2;
        else if (data.count <= 30) intensity = 3;
        else intensity = 4;
      }

      heatmapDays.push({
        date: key,
        count: data.count,
        intensity,
        durationMs: data.durationMs,
      });
    }

    const { currentStreak, longestStreak } = this.calculateStreaksDetailed(allReviews, settings.dayCutoffHour);

    return {
      days: heatmapDays,
      currentStreak,
      longestStreak,
      activeDaysCount,
      totalReviews,
    };
  }

  /**
   * Aggregates stats per deck for the Deck Statistics breakdown view.
   */
  async getDeckStatistics(): Promise<DeckStatisticItem[]> {
    const [decks, cards, reviews] = await Promise.all([
      this.database.decks.filter((d) => d.deletedAt === null).toArray(),
      this.database.cards.filter((c) => c.deletedAt === null).toArray(),
      this.database.reviews.filter((r) => r.deletedAt === null).toArray(),
    ]);

    const now = Date.now();

    // Map cards by deckId
    const cardsByDeck = new Map<string, Card[]>();
    for (const c of cards) {
      let list = cardsByDeck.get(c.deckId);
      if (!list) {
        list = [];
        cardsByDeck.set(c.deckId, list);
      }
      list.push(c);
    }

    // Map reviews by cardId
    const reviewsByCard = new Map<string, ReviewLog[]>();
    for (const r of reviews) {
      let list = reviewsByCard.get(r.cardId);
      if (!list) {
        list = [];
        reviewsByCard.set(r.cardId, list);
      }
      list.push(r);
    }

    // Precompute subdeck mapping for hierarchy
    const result: DeckStatisticItem[] = [];

    for (const deck of decks) {
      const subdeckIds = await this.deckSvc.getSubdeckIds(deck.id, true);
      const subdeckIdSet = new Set(subdeckIds);

      const directCards = cardsByDeck.get(deck.id) ?? [];
      const totalCards = cards.filter((c) => subdeckIdSet.has(c.deckId));

      let newCount = 0;
      let dueCount = 0;
      let suspendedCount = 0;
      let totalStability = 0;
      let totalDifficulty = 0;
      let stabilityCount = 0;

      for (const card of totalCards) {
        if (card.isSuspended) {
          suspendedCount++;
        } else if (card.state === CardState.New) {
          newCount++;
        } else if (card.due <= now) {
          dueCount++;
        }

        if (card.state === CardState.Review && card.fsrs) {
          totalStability += card.fsrs.stability || 0;
          totalDifficulty += card.fsrs.difficulty || 0;
          stabilityCount++;
        }
      }

      // Calculate reviews for this deck
      let deckReviewsCount = 0;
      let deckSuccessCount = 0;

      for (const card of totalCards) {
        const cardReviews = reviewsByCard.get(card.id) ?? [];
        deckReviewsCount += cardReviews.length;
        for (const r of cardReviews) {
          if (r.rating >= Rating.Hard) deckSuccessCount++;
        }
      }

      const retentionRate = deckReviewsCount > 0 ? (deckSuccessCount / deckReviewsCount) * 100 : 0;
      const averageStability = stabilityCount > 0 ? totalStability / stabilityCount : 0;
      const averageDifficulty = stabilityCount > 0 ? totalDifficulty / stabilityCount : 0;

      result.push({
        id: deck.id,
        name: deck.name,
        parentId: deck.parentId,
        directCards: directCards.length,
        totalCards: totalCards.length,
        newCount,
        dueCount,
        suspendedCount,
        totalReviews: deckReviewsCount,
        retentionRate: Math.round(retentionRate * 10) / 10,
        averageStability: Math.round(averageStability * 10) / 10,
        averageDifficulty: Math.round(averageDifficulty * 10) / 10,
      });
    }

    return result.sort((a, b) => b.totalCards - a.totalCards);
  }

  /**
   * Evaluates FSRS-specific scheduling parameters, stability, and difficulty curves.
   */
  async getFSRSStats(deckId?: string): Promise<FSRSStats> {
    const settings = settingsService.getSettings();

    let targetCardIds: Set<string> | null = null;
    if (deckId) {
      const subdeckIds = await this.deckSvc.getSubdeckIds(deckId, true);
      const set = new Set(subdeckIds);
      const cardsInDeck = await this.database.cards
        .filter((c) => c.deletedAt === null && set.has(c.deckId))
        .toArray();
      targetCardIds = new Set(cardsInDeck.map((c) => c.id));
    }

    const [cards, reviews] = await Promise.all([
      this.database.cards
        .filter((c) => c.deletedAt === null && (targetCardIds ? targetCardIds.has(c.id) : true))
        .toArray(),
      this.database.reviews
        .filter((r) => r.deletedAt === null && (targetCardIds ? targetCardIds.has(r.cardId) : true))
        .toArray(),
    ]);

    const reviewCards = cards.filter((c) => c.state === CardState.Review);

    let sumStability = 0;
    let sumDifficulty = 0;

    const stabilityDistribution = {
      under1d: 0,
      from1dTo7d: 0,
      from7dTo30d: 0,
      from30dTo90d: 0,
      over90d: 0,
    };

    const difficultyDistribution = {
      easy: 0,
      moderate: 0,
      hard: 0,
      veryHard: 0,
    };

    for (const card of reviewCards) {
      const cardAny = card as Record<string, any>;
      const s = card.fsrs?.stability ?? (typeof cardAny.stability === 'number' ? cardAny.stability : 0);
      const d = card.fsrs?.difficulty ?? (typeof cardAny.difficulty === 'number' ? cardAny.difficulty : 5);

      sumStability += s;
      sumDifficulty += d;

      if (s < 1) stabilityDistribution.under1d++;
      else if (s <= 7) stabilityDistribution.from1dTo7d++;
      else if (s <= 30) stabilityDistribution.from7dTo30d++;
      else if (s <= 90) stabilityDistribution.from30dTo90d++;
      else stabilityDistribution.over90d++;

      if (d <= 3.5) difficultyDistribution.easy++;
      else if (d <= 6.5) difficultyDistribution.moderate++;
      else if (d <= 8.5) difficultyDistribution.hard++;
      else difficultyDistribution.veryHard++;
    }

    const averageStability = reviewCards.length > 0 ? sumStability / reviewCards.length : 0;
    const averageDifficulty = reviewCards.length > 0 ? sumDifficulty / reviewCards.length : 0;

    let successfulReviews = 0;
    for (const r of reviews) {
      if (r.rating >= Rating.Hard) successfulReviews++;
    }

    const measuredRetention = reviews.length > 0 ? (successfulReviews / reviews.length) * 100 : 0;

    return {
      averageStability: Math.round(averageStability * 10) / 10,
      averageDifficulty: Math.round(averageDifficulty * 10) / 10,
      desiredRetention: settings.desiredRetention,
      measuredRetention: Math.round(measuredRetention * 10) / 10,
      stabilityDistribution,
      difficultyDistribution,
    };
  }

  /**
   * Helper to calculate current consecutive streak.
   */
  private calculateStreak(reviews: ReviewLog[], cutoffHour = 4): number {
    return this.calculateStreaksDetailed(reviews, cutoffHour).currentStreak;
  }

  /**
   * Computes both current streak and longest historical streak.
   */
  private calculateStreaksDetailed(reviews: ReviewLog[], cutoffHour = 4): { currentStreak: number; longestStreak: number } {
    if (reviews.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const dayMs = 86400000;
    const dateSet = new Set<string>();

    for (const r of reviews) {
      const adjusted = new Date(r.reviewTime);
      if (adjusted.getHours() < cutoffHour) {
        adjusted.setDate(adjusted.getDate() - 1);
      }
      dateSet.add(this.formatDateKey(adjusted));
    }

    // Sort unique dates ascending
    const sortedDates = Array.from(dateSet).sort();
    if (sortedDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

    let longest = 0;
    let currentRun = 0;
    let prevTime = 0;

    for (const dateStr of sortedDates) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const time = new Date(y!, m! - 1, d!).getTime();

      if (prevTime === 0) {
        currentRun = 1;
      } else {
        const diffDays = Math.round((time - prevTime) / dayMs);
        if (diffDays === 1) {
          currentRun++;
        } else {
          currentRun = 1;
        }
      }

      if (currentRun > longest) longest = currentRun;
      prevTime = time;
    }

    // Determine current streak
    const today = new Date();
    if (today.getHours() < cutoffHour) {
      today.setDate(today.getDate() - 1);
    }
    const todayKey = this.formatDateKey(today);

    const yesterday = new Date(today.getTime() - dayMs);
    const yesterdayKey = this.formatDateKey(yesterday);

    let currentStreak = 0;
    // Streak is active if either today or yesterday has a review
    if (dateSet.has(todayKey) || dateSet.has(yesterdayKey)) {
      let checkDate = dateSet.has(todayKey) ? today : yesterday;
      while (dateSet.has(this.formatDateKey(checkDate))) {
        currentStreak++;
        checkDate = new Date(checkDate.getTime() - dayMs);
      }
    }

    return {
      currentStreak,
      longestStreak: longest,
    };
  }
}

export const statisticsService = new StatisticsService();
