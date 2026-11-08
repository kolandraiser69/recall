import type { Deck, Note, NoteType, Card } from '../../core/models';

export interface AnkiPackageManifest {
  version: number;
  deckCount: number;
  noteCount: number;
  cardCount: number;
  mediaCount: number;
  mediaFilenames: string[];
}

export interface AnkiImportResult {
  decks: Deck[];
  noteTypes: NoteType[];
  notes: Note[];
  cards: Card[];
  mediaExtracted: number;
}

export interface AnkiImportService {
  inspectPackage(file: Blob): Promise<AnkiPackageManifest>;
  executeImport(file: Blob, targetDeckId?: string): Promise<AnkiImportResult>;
  exportDeck(deckId: string): Promise<Blob>;
}
