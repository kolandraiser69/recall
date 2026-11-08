export interface DeckSettings {
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  desiredRetention: number; // e.g. 0.90 for FSRS (80% - 97%)
  learningSteps: number[];  // in minutes, e.g. [1, 10]
  relearningSteps: number[];// in minutes, e.g. [10]
  fsrsParameters?: number[]; // Custom weights if user optimized
}

export const DEFAULT_DECK_SETTINGS: DeckSettings = {
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  desiredRetention: 0.90,
  learningSteps: [1, 10],
  relearningSteps: [10],
};

export interface Deck {
  id: string;
  name: string;             // Supports hierarchical naming: "Languages::German::A1"
  parentId: string | null;  // For explicit tree nesting
  description: string;
  settings: DeckSettings;
  order: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
