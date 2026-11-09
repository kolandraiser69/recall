import { db as defaultDb, type RecallDatabase } from '../../db/database';
import { MediaRepository } from '../../db/repositories/mediaRepository';
import { AnkiParser } from './ankiParser';
import { AnkiMapper } from './ankiMapper';
import { AnkiMediaHandler } from './ankiMedia';
import { deckSchema } from '../../core/validation/deck.schema';
import { noteTypeSchema } from '../../core/validation/noteType.schema';
import { noteSchema } from '../../core/validation/note.schema';
import { cardSchema } from '../../core/validation/card.schema';
import { reviewLogSchema } from '../../core/validation/review.schema';
import type {
  AnkiPackageManifest,
  AnkiImportOptions,
  AnkiImportProgress,
  AnkiImportResult,
} from './types';

export class AnkiImportService {
  constructor(
    private db: RecallDatabase = defaultDb,
    private mediaRepo: MediaRepository = new MediaRepository(defaultDb)
  ) {}

  /**
   * Helper to convert Blob, File, or Uint8Array into a Uint8Array buffer.
   */
  private async toUint8Array(input: Blob | File | Uint8Array): Promise<Uint8Array> {
    if (input instanceof Uint8Array) {
      return input;
    }
    if (typeof input.arrayBuffer === 'function') {
      const arrayBuffer = await input.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
    if ((input as any).buffer instanceof ArrayBuffer) {
      return new Uint8Array((input as any).buffer);
    }
    return new Uint8Array();
  }

  /**
   * Inspects an Anki .apkg file without writing to the database.
   * Returns a complete manifest with deck hierarchy, counts, and compatibility warnings.
   */
  async inspectPackage(
    file: Blob | File | Uint8Array,
    fileName?: string
  ): Promise<AnkiPackageManifest> {
    const data = await this.toUint8Array(file);
    const resolvedName = fileName || (file instanceof File ? file.name : 'collection.apkg');
    const fileSize = data.byteLength;

    return AnkiParser.inspectPackage(data, resolvedName, fileSize);
  }

  /**
   * Executes a full or selective import of an Anki .apkg package into Recall's local IndexedDB.
   *
   * Guarantees transactional safety via Dexie transactions and validates all records
   * using Zod domain schemas.
   */
  async executeImport(
    file: Blob | File | Uint8Array,
    options: AnkiImportOptions,
    onProgress?: (progress: AnkiImportProgress) => void
  ): Promise<AnkiImportResult> {
    const startTime = Date.now();

    // 1. Reading file bytes
    onProgress?.({
      stage: 'reading',
      progress: 5,
      currentStep: 'Reading package file bytes...',
      importedDecks: 0,
      importedNotes: 0,
      importedCards: 0,
      importedMedia: 0,
      importedReviews: 0,
    });

    const data = await this.toUint8Array(file);

    // 2. Parsing archive and SQLite
    onProgress?.({
      stage: 'parsing',
      progress: 20,
      currentStep: 'Decompressing archive and reading SQLite database...',
      importedDecks: 0,
      importedNotes: 0,
      importedCards: 0,
      importedMedia: 0,
      importedReviews: 0,
    });

    const parsed = await AnkiParser.parseAnkiPackage(data);

    // 3. Extracting Media
    let mediaExtracted = 0;
    const mediaWarnings: string[] = [];

    if (options.importMedia && Object.keys(parsed.mediaMap).length > 0) {
      onProgress?.({
        stage: 'extracting_media',
        progress: 35,
        currentStep: `Extracting ${Object.keys(parsed.mediaMap).length} media items...`,
        importedDecks: 0,
        importedNotes: 0,
        importedCards: 0,
        importedMedia: 0,
        importedReviews: 0,
      });

      const mediaRes = await AnkiMediaHandler.importMedia(
        parsed.zipFiles,
        parsed.mediaMap,
        this.mediaRepo,
        (current, total) => {
          const ratio = current / total;
          const p = 35 + Math.round(ratio * 25); // 35% to 60%
          onProgress?.({
            stage: 'extracting_media',
            progress: p,
            currentStep: `Importing media files (${current}/${total})...`,
            importedDecks: 0,
            importedNotes: 0,
            importedCards: 0,
            importedMedia: current,
            importedReviews: 0,
          });
        }
      );

      mediaExtracted = mediaRes.savedCount;
      mediaWarnings.push(...mediaRes.warnings);
    }

    // 4. Map to Recall Domain Models
    onProgress?.({
      stage: 'parsing',
      progress: 65,
      currentStep: 'Mapping Anki models, notes, cards, and scheduling...',
      importedDecks: 0,
      importedNotes: 0,
      importedCards: 0,
      importedMedia: mediaExtracted,
      importedReviews: 0,
    });

    const existingDecks = await this.db.decks.toArray();
    const existingNoteTypes = await this.db.noteTypes.toArray();

    const mapped = AnkiMapper.mapToRecall(parsed, options, existingDecks, existingNoteTypes);

    // Validate records before persisting
    onProgress?.({
      stage: 'saving',
      progress: 75,
      currentStep: 'Validating domain models...',
      importedDecks: 0,
      importedNotes: 0,
      importedCards: 0,
      importedMedia: mediaExtracted,
      importedReviews: 0,
    });

    const validatedDecks = mapped.decks.map((d) => deckSchema.parse(d));
    const validatedNoteTypes = mapped.noteTypes.map((nt) => noteTypeSchema.parse(nt));
    const validatedNotes = mapped.notes.map((n) => noteSchema.parse(n));
    const validatedCards = mapped.cards.map((c) => cardSchema.parse(c));
    const validatedReviews = mapped.reviews.map((r) => reviewLogSchema.parse(r));

    // 5. Persist to IndexedDB within Dexie transaction
    onProgress?.({
      stage: 'saving',
      progress: 85,
      currentStep: `Writing ${validatedNotes.length} notes and ${validatedCards.length} cards to database...`,
      importedDecks: validatedDecks.length,
      importedNotes: validatedNotes.length,
      importedCards: validatedCards.length,
      importedMedia: mediaExtracted,
      importedReviews: validatedReviews.length,
    });

    await this.db.transaction(
      'rw',
      [this.db.decks, this.db.noteTypes, this.db.notes, this.db.cards, this.db.reviews],
      async () => {
        if (validatedDecks.length > 0) {
          await this.db.decks.bulkPut(validatedDecks);
        }
        if (validatedNoteTypes.length > 0) {
          await this.db.noteTypes.bulkPut(validatedNoteTypes);
        }
        if (validatedNotes.length > 0) {
          await this.db.notes.bulkPut(validatedNotes);
        }
        if (validatedCards.length > 0) {
          await this.db.cards.bulkPut(validatedCards);
        }
        if (validatedReviews.length > 0) {
          await this.db.reviews.bulkPut(validatedReviews);
        }
      }
    );

    // 6. Complete
    onProgress?.({
      stage: 'done',
      progress: 100,
      currentStep: 'Import completed successfully.',
      importedDecks: validatedDecks.length,
      importedNotes: validatedNotes.length,
      importedCards: validatedCards.length,
      importedMedia: mediaExtracted,
      importedReviews: validatedReviews.length,
    });

    const allWarnings = [
      ...parsed.warnings,
      ...parsed.unsupportedFeatures,
      ...mapped.warnings,
      ...mediaWarnings,
    ];

    return {
      decks: validatedDecks,
      noteTypes: validatedNoteTypes,
      notes: validatedNotes,
      cards: validatedCards,
      reviews: validatedReviews,
      mediaExtracted,
      warnings: allWarnings,
      durationMs: Date.now() - startTime,
    };
  }
}

export const ankiImportService = new AnkiImportService();
