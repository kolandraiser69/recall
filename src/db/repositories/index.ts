export * from './deckRepository';
export * from './noteTypeRepository';
export * from './noteRepository';
export * from './cardRepository';
export * from './reviewRepository';
export * from './mediaRepository';

import { db, type RecallDatabase } from '../database';
import { DeckRepository } from './deckRepository';
import { NoteTypeRepository } from './noteTypeRepository';
import { NoteRepository } from './noteRepository';
import { CardRepository } from './cardRepository';
import { ReviewRepository } from './reviewRepository';
import { MediaRepository } from './mediaRepository';

export interface Repositories {
  decks: DeckRepository;
  noteTypes: NoteTypeRepository;
  notes: NoteRepository;
  cards: CardRepository;
  reviews: ReviewRepository;
  media: MediaRepository;
}

export function createRepositories(database: RecallDatabase = db): Repositories {
  return {
    decks: new DeckRepository(database),
    noteTypes: new NoteTypeRepository(database),
    notes: new NoteRepository(database),
    cards: new CardRepository(database),
    reviews: new ReviewRepository(database),
    media: new MediaRepository(database),
  };
}

export const repositories = createRepositories(db);
