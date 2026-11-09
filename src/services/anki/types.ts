import type { Deck, Note, NoteType, Card, ReviewLog } from '../../core/models';

export interface AnkiDeckManifest {
  id: number | string;
  name: string;
  cardCount: number;
  noteCount: number;
}

export interface AnkiNoteTypeManifest {
  id: number | string;
  name: string;
  fieldCount: number;
  templateCount: number;
}

export interface AnkiPackageManifest {
  fileName: string;
  fileSize: number;
  schemaVersion: number | string;
  decks: AnkiDeckManifest[];
  noteTypes: AnkiNoteTypeManifest[];
  noteCount: number;
  cardCount: number;
  revlogCount: number;
  mediaCount: number;
  mediaFilenames: string[];
  warnings: string[];
  unsupportedFeatures: string[];
}

export interface AnkiImportOptions {
  selectedDeckIds?: (number | string)[];
  importMedia: boolean;
  importReviews: boolean;
  importScheduling: boolean;
  conflictStrategy: 'rename' | 'skip' | 'merge';
  targetDeckId?: string; // Optional parent deck in Recall to nest imported decks under
}

export type AnkiImportStage =
  | 'reading'
  | 'parsing'
  | 'extracting_media'
  | 'saving'
  | 'done'
  | 'error';

export interface AnkiImportProgress {
  stage: AnkiImportStage;
  progress: number; // 0 to 100
  currentStep: string;
  importedDecks: number;
  importedNotes: number;
  importedCards: number;
  importedMedia: number;
  importedReviews: number;
}

export interface AnkiImportResult {
  decks: Deck[];
  noteTypes: NoteType[];
  notes: Note[];
  cards: Card[];
  reviews: ReviewLog[];
  mediaExtracted: number;
  warnings: string[];
  durationMs: number;
}

export interface AnkiExportOptions {
  deckId?: string; // undefined = entire collection, otherwise specific deck + subdecks
  includeMedia: boolean;
  includeReviews: boolean;
  filename?: string;
}

// Low-level parsed models from SQLite collection.anki2
export interface RawAnkiModel {
  id: number | string;
  name: string;
  type: number; // 0: standard, 1: cloze
  flds: Array<{
    name: string;
    ord: number;
  }>;
  tmpls: Array<{
    name: string;
    ord: number;
    qfmt: string;
    afmt: string;
    bafmt?: string;
    bqfmt?: string;
  }>;
  css: string;
}

export interface RawAnkiDeck {
  id: number | string;
  name: string;
  desc?: string;
}

export interface RawAnkiNote {
  id: number;
  guid: string;
  mid: number;
  mod: number;
  usn: number;
  tags: string;
  flds: string; // Separated by \x1f
  sfld: string;
  csum: number;
  flags: number;
  data: string;
}

export interface RawAnkiCard {
  id: number;
  nid: number;
  did: number;
  ord: number;
  mod: number;
  usn: number;
  type: number;
  queue: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
  odue: number;
  odid: number;
  flags: number;
  data: string;
}

export interface RawAnkiRevlog {
  id: number;
  cid: number;
  usn: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
}

export interface ParsedAnkiCollection {
  schemaVersion: number;
  creationTime: number; // Seconds
  models: Map<number | string, RawAnkiModel>;
  decks: Map<number | string, RawAnkiDeck>;
  notes: RawAnkiNote[];
  cards: RawAnkiCard[];
  revlog: RawAnkiRevlog[];
  mediaMap: Record<string, string>; // "0" -> "image.png"
  zipFiles: Record<string, Uint8Array>;
  warnings: string[];
  unsupportedFeatures: string[];
}
