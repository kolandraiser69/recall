import { db, type RecallDatabase } from '../db/database';
import { settingsService } from './settingsService';
import { deckSchema } from '../core/validation/deck.schema';
import { noteTypeSchema } from '../core/validation/noteType.schema';
import { noteSchema } from '../core/validation/note.schema';
import { cardSchema } from '../core/validation/card.schema';
import { reviewLogSchema } from '../core/validation/review.schema';
import { mediaItemSchema } from '../core/validation/media.schema';
import { appSettingsSchema } from '../core/validation/settings.schema';
import { DEFAULT_NOTE_TYPES } from '../db/migrations/v1';
import type { Deck, Note, Card, NoteType, ReviewLog, MediaItem, AppSettings } from '../core/models';

export interface RecallBackupPayload {
  format: 'recall_backup';
  version: 1;
  createdAt: number;
  metadata: {
    appVersion: string;
    deckCount: number;
    noteCount: number;
    cardCount: number;
    reviewCount: number;
    mediaCount: number;
  };
  settings: AppSettings;
  decks: Deck[];
  noteTypes: NoteType[];
  notes: Note[];
  cards: Card[];
  reviews: ReviewLog[];
  media: Array<{
    filename: string;
    mimeType: string;
    base64Data: string;
    hash: string;
    size: number;
    updatedAt: number;
    deletedAt: number | null;
  }>;
}

export type RecallBackup = RecallBackupPayload;

export interface RestoreOptions {
  mode: 'replace' | 'merge';
}

export interface RestoreResult {
  decksRestored: number;
  notesRestored: number;
  cardsRestored: number;
  reviewsRestored: number;
  mediaRestored: number;
  settingsRestored: boolean;
}

export class BackupService {
  constructor(private database: RecallDatabase = db) {}

  /**
   * Helper to convert Blob to base64 string.
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const commaIndex = res.indexOf(',');
          resolve(commaIndex >= 0 ? res.substring(commaIndex + 1) : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Node.js fallback
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  }

  /**
   * Helper to convert base64 string to Blob.
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    if (typeof atob !== 'undefined') {
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
    }

    // Node.js fallback
    const buffer = Buffer.from(base64, 'base64');
    return new Blob([new Uint8Array(buffer)], { type: mimeType });
  }

  /**
   * Generates a complete, lossless backup payload of the entire Recall IndexedDB.
   */
  async createBackup(): Promise<{ payload: RecallBackupPayload; jsonString: string; filename: string }> {
    const now = Date.now();
    const settings = settingsService.getSettings();

    const [decks, noteTypes, notes, cards, reviews, mediaItems] = await Promise.all([
      this.database.decks.toArray(),
      this.database.noteTypes.toArray(),
      this.database.notes.toArray(),
      this.database.cards.toArray(),
      this.database.reviews.toArray(),
      this.database.media.toArray(),
    ]);

    // Encode media blobs to base64
    const encodedMedia: RecallBackupPayload['media'] = [];
    for (const item of mediaItems) {
      if (item.data) {
        const base64Data = await this.blobToBase64(item.data);
        encodedMedia.push({
          filename: item.filename,
          mimeType: item.mimeType,
          base64Data,
          hash: item.hash,
          size: item.size,
          updatedAt: item.updatedAt,
          deletedAt: item.deletedAt,
        });
      }
    }

    const payload: RecallBackupPayload = {
      format: 'recall_backup',
      version: 1,
      createdAt: now,
      metadata: {
        appVersion: '0.1.0',
        deckCount: decks.filter((d) => d.deletedAt === null).length,
        noteCount: notes.filter((n) => n.deletedAt === null).length,
        cardCount: cards.filter((c) => c.deletedAt === null).length,
        reviewCount: reviews.filter((r) => r.deletedAt === null).length,
        mediaCount: encodedMedia.filter((m) => m.deletedAt === null).length,
      },
      settings,
      decks,
      noteTypes,
      notes,
      cards,
      reviews,
      media: encodedMedia,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `recall_backup_${dateStr}.json`;

    return { payload, jsonString, filename };
  }

  /**
   * Triggers client browser download of backup JSON file.
   */
  async exportBackupFile(): Promise<string> {
    const { jsonString, filename } = await this.createBackup();

    if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    return filename;
  }

  /**
   * Helper to parse and validate a backup JSON string without restoring it.
   */
  async parseAndValidateBackup(jsonString: string): Promise<RecallBackupPayload> {
    let payload: RecallBackupPayload;
    try {
      payload = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid backup file: Not valid JSON.');
    }
    if (payload.format !== 'recall_backup' || payload.version !== 1) {
      throw new Error('Unsupported or unrecognized backup format. Expected "recall_backup" version 1.');
    }
    return payload;
  }

  /**
   * Alias for creating and returning the backup payload.
   */
  async exportBackup(_includeMedia: boolean = true): Promise<RecallBackupPayload> {
    const { payload } = await this.createBackup();
    return payload;
  }

  /**
   * Downloads a given backup payload to user device.
   */
  downloadBackupFile(backup: RecallBackupPayload): void {
    const jsonString = JSON.stringify(backup, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `recall_backup_${dateStr}.json`;

    if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }

  /**
   * Alias for clearAllData
   */
  async factoryReset(): Promise<void> {
    return this.clearAllData();
  }

  /**
   * Validates and restores a backup JSON file or string into IndexedDB.
   */
  async restoreBackup(
    content: string | File | Blob | RecallBackupPayload,
    options: RestoreOptions | 'replace' | 'merge' = { mode: 'replace' }
  ): Promise<RestoreResult> {
    const opts: RestoreOptions = typeof options === 'string' ? { mode: options } : options;
    let jsonText: string;

    if (typeof content === 'string') {
      jsonText = content;
    } else if (content && typeof (content as Blob).text === 'function') {
      jsonText = await (content as Blob).text();
    } else {
      jsonText = JSON.stringify(content);
    }

    let payload: RecallBackupPayload;
    try {
      payload = JSON.parse(jsonText);
    } catch {
      throw new Error('Invalid backup file: Not valid JSON.');
    }

    // Validate format header
    if (payload.format !== 'recall_backup' || payload.version !== 1) {
      throw new Error('Unsupported or unrecognized backup format. Expected "recall_backup" version 1.');
    }

    // Validate and parse records with domain schemas
    const validDecks = payload.decks.map((d) => deckSchema.parse(d));
    const validNoteTypes = payload.noteTypes.map((nt) => noteTypeSchema.parse(nt));
    const validNotes = payload.notes.map((n) => noteSchema.parse(n));
    const validCards = payload.cards.map((c) => cardSchema.parse(c));
    const validReviews = payload.reviews.map((r) => reviewLogSchema.parse(r));

    // Decode media items
    const validMediaItems: MediaItem[] = [];
    if (Array.isArray(payload.media)) {
      for (const m of payload.media) {
        const blob = this.base64ToBlob(m.base64Data, m.mimeType);
        const item: MediaItem = {
          filename: m.filename,
          mimeType: m.mimeType,
          data: blob,
          hash: m.hash,
          size: m.size,
          updatedAt: m.updatedAt,
          deletedAt: m.deletedAt,
        };
        validMediaItems.push(mediaItemSchema.parse(item));
      }
    }

    // Validate settings if present
    let validSettings: AppSettings | null = null;
    if (payload.settings) {
      validSettings = appSettingsSchema.parse(payload.settings);
    }

    // Execute atomic restore transaction in Dexie
    await this.database.transaction(
      'rw',
      [
        this.database.decks,
        this.database.noteTypes,
        this.database.notes,
        this.database.cards,
        this.database.reviews,
        this.database.media,
      ],
      async () => {
        if (opts.mode === 'replace') {
          // Clear all existing data
          await Promise.all([
            this.database.decks.clear(),
            this.database.noteTypes.clear(),
            this.database.notes.clear(),
            this.database.cards.clear(),
            this.database.reviews.clear(),
            this.database.media.clear(),
          ]);
        }

        // Write restored items
        if (validDecks.length > 0) await this.database.decks.bulkPut(validDecks);
        if (validNoteTypes.length > 0) await this.database.noteTypes.bulkPut(validNoteTypes);
        if (validNotes.length > 0) await this.database.notes.bulkPut(validNotes);
        if (validCards.length > 0) await this.database.cards.bulkPut(validCards);
        if (validReviews.length > 0) await this.database.reviews.bulkPut(validReviews);
        if (validMediaItems.length > 0) await this.database.media.bulkPut(validMediaItems);
      }
    );

    // Apply settings if provided
    if (validSettings) {
      settingsService.saveSettings(validSettings);
    }

    return {
      decksRestored: validDecks.length,
      notesRestored: validNotes.length,
      cardsRestored: validCards.length,
      reviewsRestored: validReviews.length,
      mediaRestored: validMediaItems.length,
      settingsRestored: Boolean(validSettings),
    };
  }

  /**
   * Performs a clean factory reset of the entire local database.
   * Restores default note types.
   */
  async clearAllData(): Promise<void> {
    await this.database.transaction(
      'rw',
      [
        this.database.decks,
        this.database.noteTypes,
        this.database.notes,
        this.database.cards,
        this.database.reviews,
        this.database.media,
      ],
      async () => {
        await Promise.all([
          this.database.decks.clear(),
          this.database.noteTypes.clear(),
          this.database.notes.clear(),
          this.database.cards.clear(),
          this.database.reviews.clear(),
          this.database.media.clear(),
        ]);

        // Re-populate standard default note types
        await this.database.noteTypes.bulkAdd(DEFAULT_NOTE_TYPES);
      }
    );

    // Reset settings
    settingsService.resetSettings();
  }
}

export const backupService = new BackupService();
