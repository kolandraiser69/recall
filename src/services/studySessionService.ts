import { db, type RecallDatabase } from '../db/database';
import type { Card } from '../core/models/card';
import { CardState, Rating } from '../core/models/card';
import type { Deck, DeckSettings } from '../core/models/deck';
import { DEFAULT_DECK_SETTINGS } from '../core/models/deck';
import type { Note } from '../core/models/note';
import type { NoteType } from '../core/models/noteType';
import type { ReviewLog } from '../core/models/review';
import { fsrsService } from './fsrsService';
import { deckService } from './deckService';
import { ReviewRepository } from '../db/repositories/reviewRepository';
import { generateId } from '../utils/id';

export interface StudyCardItem {
  card: Card;
  note: Note;
  noteType: NoteType;
  deck: Deck;
}

export type SessionEmptyReason =
  | 'none'
  | 'no_cards'
  | 'all_suspended'
  | 'daily_limits_reached'
  | 'no_due_cards';

export interface SessionStats {
  cardsAnswered: number;
  newCardsStudied: number;
  reviewCardsStudied: number;
  ratings: Record<Rating, number>;
  startTime: number;
  endTime?: number;
}

export interface UndoRecord {
  cardBefore: Card;
  cardAfter: Card;
  reviewLogId: string;
  item: StudyCardItem;
  wasRequeued: boolean;
}

export interface StudySession {
  id: string;
  targetDeckId: string | null;
  targetDeckName: string;
  deckPath: Deck[];
  settings: DeckSettings;
  queue: StudyCardItem[];
  currentCardItem: StudyCardItem | null;
  initialTotal: number;
  emptyReason: SessionEmptyReason;
  stats: SessionStats;
  undoStack: UndoRecord[];
  isCompleted: boolean;
}

export interface StartSessionOptions {
  deckId?: string | null;
  includeSubdecks?: boolean;
  now?: number;
}

export class StudySessionService {
  private reviewRepository: ReviewRepository;

  constructor(private database: RecallDatabase = db) {
    this.reviewRepository = new ReviewRepository(database);
  }

  /**
   * Initializes a complete study session based on deck settings and daily limits.
   */
  async startSession(options: StartSessionOptions = {}): Promise<StudySession> {
    const now = options.now ?? Date.now();
    const includeSubdecks = options.includeSubdecks ?? true;
    const targetDeckId = options.deckId ?? null;

    // 1. Determine target decks
    let targetDeckIds: string[] = [];
    let primaryDeck: Deck | undefined;
    let deckPath: Deck[] = [];

    if (targetDeckId) {
      primaryDeck = await this.database.decks.get(targetDeckId);
      if (!primaryDeck || primaryDeck.deletedAt !== null) {
        throw new Error(`Deck ${targetDeckId} not found`);
      }
      targetDeckIds = includeSubdecks
        ? await deckService.getSubdeckIds(targetDeckId, true)
        : [targetDeckId];
      deckPath = await deckService.getDeckPath(targetDeckId);
    } else {
      const allActiveDecks = await this.database.decks.filter((d) => d.deletedAt === null).toArray();
      targetDeckIds = allActiveDecks.map((d) => d.id);
    }

    const settings = primaryDeck?.settings ?? DEFAULT_DECK_SETTINGS;
    const targetDeckName = primaryDeck ? primaryDeck.name : 'All Collections';

    // 2. Load all active cards for target decks
    const allCardsInDecks = await this.database.cards
      .filter((c) => c.deletedAt === null && targetDeckIds.includes(c.deckId))
      .toArray();

    if (allCardsInDecks.length === 0) {
      return this.createEmptySession(targetDeckId, targetDeckName, deckPath, settings, 'no_cards');
    }

    const nonSuspendedCards = allCardsInDecks.filter((c) => !c.isSuspended);
    if (nonSuspendedCards.length === 0) {
      return this.createEmptySession(targetDeckId, targetDeckName, deckPath, settings, 'all_suspended');
    }

    // 3. Calculate today's reviews to enforce daily limits
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = todayStart.getTime();

    // Query reviews done today
    const reviewsToday = await this.database.reviews
      .where('reviewTime')
      .aboveOrEqual(todayStartTimestamp)
      .filter((r) => r.deletedAt === null)
      .toArray();

    // Filter reviews to target decks
    const cardDeckMap = new Map<string, string>(allCardsInDecks.map((c) => [c.id, c.deckId]));
    const reviewsForTargetDecks = reviewsToday.filter((r) => {
      const dId = cardDeckMap.get(r.cardId);
      return dId && targetDeckIds.includes(dId);
    });

    const newReviewedToday = reviewsForTargetDecks.filter((r) => r.state === CardState.New).length;
    const reviewsReviewedToday = reviewsForTargetDecks.filter((r) => r.state !== CardState.New).length;

    const remainingNewSlots = Math.max(0, settings.newCardsPerDay - newReviewedToday);
    const remainingReviewSlots = Math.max(0, settings.maxReviewsPerDay - reviewsReviewedToday);

    // 4. Select due cards and new cards
    const dueCards = nonSuspendedCards
      .filter((c) => c.state !== CardState.New && c.due <= now)
      .sort((a, b) => a.due - b.due);

    const newCards = nonSuspendedCards
      .filter((c) => c.state === CardState.New)
      .sort((a, b) => a.createdAt - b.createdAt);

    // Check if daily limits prevented studying
    const hadDueCards = dueCards.length > 0;
    const hadNewCards = newCards.length > 0;

    const selectedDue = dueCards.slice(0, remainingReviewSlots);
    const selectedNew = newCards.slice(0, remainingNewSlots);

    const selectedCards = [...selectedDue, ...selectedNew];

    if (selectedCards.length === 0) {
      if ((hadDueCards && remainingReviewSlots === 0) || (hadNewCards && remainingNewSlots === 0)) {
        return this.createEmptySession(targetDeckId, targetDeckName, deckPath, settings, 'daily_limits_reached');
      }
      return this.createEmptySession(targetDeckId, targetDeckName, deckPath, settings, 'no_due_cards');
    }

    // 5. Pre-load Notes and NoteTypes for optimal zero-latency rendering
    const noteIds = Array.from(new Set(selectedCards.map((c) => c.noteId)));
    const [notes, noteTypes, decks] = await Promise.all([
      this.database.notes.where('id').anyOf(noteIds).toArray(),
      this.database.noteTypes.filter((nt) => nt.deletedAt === null).toArray(),
      this.database.decks.where('id').anyOf(targetDeckIds).toArray(),
    ]);

    const noteMap = new Map<string, Note>(notes.map((n) => [n.id, n]));
    const noteTypeMap = new Map<string, NoteType>(noteTypes.map((nt) => [nt.id, nt]));
    const deckMap = new Map<string, Deck>(decks.map((d) => [d.id, d]));

    const queue: StudyCardItem[] = [];
    for (const card of selectedCards) {
      const note = noteMap.get(card.noteId);
      if (!note) continue;
      const noteType = noteTypeMap.get(note.noteTypeId);
      if (!noteType) continue;
      const deck = deckMap.get(card.deckId) ?? primaryDeck ?? {
        id: card.deckId,
        name: 'Deck',
        parentId: null,
        description: '',
        settings: DEFAULT_DECK_SETTINGS,
        order: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      queue.push({ card, note, noteType, deck });
    }

    if (queue.length === 0) {
      return this.createEmptySession(targetDeckId, targetDeckName, deckPath, settings, 'no_cards');
    }

    const currentCardItem = queue.shift()!;

    return {
      id: generateId(),
      targetDeckId,
      targetDeckName,
      deckPath,
      settings,
      queue,
      currentCardItem,
      initialTotal: queue.length + 1,
      emptyReason: 'none',
      stats: {
        cardsAnswered: 0,
        newCardsStudied: 0,
        reviewCardsStudied: 0,
        ratings: {
          [Rating.Again]: 0,
          [Rating.Hard]: 0,
          [Rating.Good]: 0,
          [Rating.Easy]: 0,
          [Rating.Manual]: 0,
        },
        startTime: now,
      },
      undoStack: [],
      isCompleted: false,
    };
  }

  /**
   * Helper to construct an empty study session with an explicit reason.
   */
  private createEmptySession(
    targetDeckId: string | null,
    targetDeckName: string,
    deckPath: Deck[],
    settings: DeckSettings,
    emptyReason: SessionEmptyReason
  ): StudySession {
    return {
      id: generateId(),
      targetDeckId,
      targetDeckName,
      deckPath,
      settings,
      queue: [],
      currentCardItem: null,
      initialTotal: 0,
      emptyReason,
      stats: {
        cardsAnswered: 0,
        newCardsStudied: 0,
        reviewCardsStudied: 0,
        ratings: {
          [Rating.Again]: 0,
          [Rating.Hard]: 0,
          [Rating.Good]: 0,
          [Rating.Easy]: 0,
          [Rating.Manual]: 0,
        },
        startTime: Date.now(),
        endTime: Date.now(),
      },
      undoStack: [],
      isCompleted: true,
    };
  }

  /**
   * Processes a rating submission within an atomic Dexie transaction.
   * Updates card state, appends review log, handles intraday requeuing, and yields next card.
   */
  async submitReview(
    session: StudySession,
    rating: Rating,
    durationMs = 0
  ): Promise<{ session: StudySession; updatedCard: Card; reviewLog: ReviewLog }> {
    const currentItem = session.currentCardItem;
    if (!currentItem || session.isCompleted) {
      throw new Error('No active card in session');
    }

    const card = currentItem.card;
    const now = new Date();

    // 1. Calculate next FSRS review
    const calculation = fsrsService.calculateNextReview(
      card,
      rating,
      currentItem.deck.settings,
      now,
      durationMs
    );

    // 2. Perform atomic database update
    let savedReviewLog!: ReviewLog;
    await this.database.transaction('rw', [this.database.cards, this.database.reviews], async () => {
      await this.database.cards.put(calculation.updatedCard);
      savedReviewLog = await this.reviewRepository.create(calculation.reviewLogData);
    });

    // 3. Update session statistics
    const stats = { ...session.stats };
    stats.cardsAnswered++;
    stats.ratings[rating] = (stats.ratings[rating] ?? 0) + 1;
    if (card.state === CardState.New) {
      stats.newCardsStudied++;
    } else {
      stats.reviewCardsStudied++;
    }

    // 4. In-Session Relearning & Queue Management:
    // If user failed (Again), card remains in queue for repeat today
    let wasRequeued = false;
    const newQueue = [...session.queue];

    if (rating === Rating.Again) {
      wasRequeued = true;
      const requeuedItem: StudyCardItem = {
        ...currentItem,
        card: calculation.updatedCard,
      };
      // Insert card with a reasonable offset (e.g. 3 cards ahead or at the end if fewer)
      const insertIdx = Math.min(3, newQueue.length);
      newQueue.splice(insertIdx, 0, requeuedItem);
    }

    // 5. Create Undo Record
    const undoRecord: UndoRecord = {
      cardBefore: card,
      cardAfter: calculation.updatedCard,
      reviewLogId: savedReviewLog.id,
      item: currentItem,
      wasRequeued,
    };

    const nextItem = newQueue.shift() ?? null;
    const isCompleted = nextItem === null;
    if (isCompleted) {
      stats.endTime = Date.now();
    }

    const updatedSession: StudySession = {
      ...session,
      queue: newQueue,
      currentCardItem: nextItem,
      stats,
      undoStack: [...session.undoStack, undoRecord],
      isCompleted,
    };

    return {
      session: updatedSession,
      updatedCard: calculation.updatedCard,
      reviewLog: savedReviewLog,
    };
  }

  /**
   * Reverts the most recently submitted card rating in the current session.
   * Atomically restores previous card scheduling state and soft-deletes the created review log.
   */
  async undoLastReview(session: StudySession): Promise<StudySession> {
    if (session.undoStack.length === 0) {
      throw new Error('No reviews to undo');
    }

    const undoStack = [...session.undoStack];
    const lastUndo = undoStack.pop()!;

    // 1. Revert Card and soft-tombstone ReviewLog in database
    await this.database.transaction('rw', [this.database.cards, this.database.reviews], async () => {
      await this.database.cards.put(lastUndo.cardBefore);
      // Soft-delete review log to keep append-only audit while removing from stats
      await this.reviewRepository.delete(lastUndo.reviewLogId, false);
    });

    // 2. Adjust session stats
    const stats = { ...session.stats };
    stats.cardsAnswered = Math.max(0, stats.cardsAnswered - 1);
    if (lastUndo.cardBefore.state === CardState.New) {
      stats.newCardsStudied = Math.max(0, stats.newCardsStudied - 1);
    } else {
      stats.reviewCardsStudied = Math.max(0, stats.reviewCardsStudied - 1);
    }
    stats.endTime = undefined;

    // 3. Rebuild queue
    let newQueue = [...session.queue];

    // If the card had been re-enqueued on Again, remove that extra copy
    if (lastUndo.wasRequeued) {
      const idx = newQueue.findIndex((item) => item.card.id === lastUndo.cardBefore.id);
      if (idx !== -1) {
        newQueue.splice(idx, 1);
      }
    }

    // If there was an active current item, push it back to the head of the queue
    if (session.currentCardItem) {
      newQueue = [session.currentCardItem, ...newQueue];
    }

    // Set restored card as the active current item
    const restoredCurrentItem: StudyCardItem = {
      ...lastUndo.item,
      card: lastUndo.cardBefore,
    };

    return {
      ...session,
      queue: newQueue,
      currentCardItem: restoredCurrentItem,
      stats,
      undoStack,
      isCompleted: false,
    };
  }
}

export const studySessionService = new StudySessionService();
