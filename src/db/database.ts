import Dexie, { type Table } from 'dexie';
import type {
  Deck,
  Note,
  Card,
  NoteType,
  ReviewLog,
  MediaItem,
  SyncQueueItem,
  CalendarEvent,
  CalendarRecurringRule,
  CalendarException,
  CalendarCategory,
  Quicklink,
} from '../core/models';
import { SCHEMA_V1, DEFAULT_NOTE_TYPES } from './migrations/v1';
import {
  SCHEMA_V2,
  INITIAL_CALENDAR_CATEGORIES,
  INITIAL_QUICKLINKS,
} from './migrations/v2';
import { requestStoragePersistence } from './storagePersistence';

export class RecallDatabase extends Dexie {
  decks!: Table<Deck, string>;
  notes!: Table<Note, string>;
  cards!: Table<Card, string>;
  noteTypes!: Table<NoteType, string>;
  reviews!: Table<ReviewLog, string>;
  media!: Table<MediaItem, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  // Phase 6.5 & 7 Tables
  calendarEvents!: Table<CalendarEvent, string>;
  calendarRecurringRules!: Table<CalendarRecurringRule, string>;
  calendarExceptions!: Table<CalendarException, string>;
  calendarCategories!: Table<CalendarCategory, string>;
  quicklinks!: Table<Quicklink, string>;

  constructor(databaseName = 'RecallDatabase') {
    super(databaseName);

    // Schema Version 1
    this.version(1).stores(SCHEMA_V1);

    // Schema Version 2: Calendar & Quicklinks
    this.version(2)
      .stores(SCHEMA_V2)
      .upgrade(async (tx) => {
        // Upgrade existing databases by adding default categories and quicklinks
        const catCount = await tx.table('calendarCategories').count();
        if (catCount === 0) {
          await tx.table('calendarCategories').bulkAdd(INITIAL_CALENDAR_CATEGORIES);
        }
        const qlCount = await tx.table('quicklinks').count();
        if (qlCount === 0) {
          await tx.table('quicklinks').bulkAdd(INITIAL_QUICKLINKS);
        }
      });

    // Initial database population hook (runs once on DB creation)
    this.on('populate', (tx) => {
      tx.table('noteTypes').bulkAdd(DEFAULT_NOTE_TYPES);
      tx.table('calendarCategories').bulkAdd(INITIAL_CALENDAR_CATEGORIES);
      tx.table('quicklinks').bulkAdd(INITIAL_QUICKLINKS);
    });
  }

  /**
   * Initializes database and requests browser storage persistence.
   * Tolerates persistence refusal gracefully.
   */
  async initialize(): Promise<void> {
    if (!this.isOpen()) {
      await this.open();
    }
    // Attempt to secure persistent storage (non-blocking, tolerant)
    requestStoragePersistence().catch((err) => {
      console.warn('Storage persistence request error:', err);
    });
  }

  /**
   * Resets all data in the database (useful for testing and user-initiated full reset).
   */
  async clearAllTables(): Promise<void> {
    await this.transaction('rw', [
      this.decks,
      this.notes,
      this.cards,
      this.noteTypes,
      this.reviews,
      this.media,
      this.syncQueue,
      this.calendarEvents,
      this.calendarRecurringRules,
      this.calendarExceptions,
      this.calendarCategories,
      this.quicklinks,
    ], async () => {
      await Promise.all([
        this.decks.clear(),
        this.notes.clear(),
        this.cards.clear(),
        this.noteTypes.clear(),
        this.reviews.clear(),
        this.media.clear(),
        this.syncQueue.clear(),
        this.calendarEvents.clear(),
        this.calendarRecurringRules.clear(),
        this.calendarExceptions.clear(),
        this.calendarCategories.clear(),
        this.quicklinks.clear(),
      ]);
    });
  }
}

// Global default singleton instance
export const db = new RecallDatabase();
