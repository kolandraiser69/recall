export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export enum Rating {
  Manual = 0,
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface FSRSData {
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: CardState;
  last_review?: number; // Unix timestamp in ms
}

export interface Card {
  id: string;               // UUID v4
  noteId: string;           // Reference to parent Note
  deckId: string;           // Direct deck containment
  templateIndex: number;    // Index of the template from NoteType (or cloze index: 0, 1, 2...)
  state: CardState;         // Current learning state
  due: number;              // Due timestamp in ms
  fsrs: FSRSData;           // Embedded FSRS parameters
  isSuspended?: boolean;    // Optional flag: card suspended from study session
  isFlagged?: boolean;      // Optional flag: card marked with color flag
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null; // Tombstone for sync
}
