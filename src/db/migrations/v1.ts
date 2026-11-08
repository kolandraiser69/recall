import type { NoteType } from '../../core/models/noteType';

export const SCHEMA_V1 = {
  decks: 'id, parentId, name, updatedAt, deletedAt',
  notes: 'id, noteTypeId, *tags, updatedAt, deletedAt',
  cards: 'id, noteId, deckId, state, due, [deckId+due], [deckId+state], updatedAt, deletedAt',
  noteTypes: 'id, name, updatedAt, deletedAt',
  reviews: 'id, cardId, reviewTime, rating, deletedAt, [cardId+reviewTime]',
  media: 'filename, hash, updatedAt, deletedAt',
  syncQueue: 'id, table, entityId, timestamp',
};

export const DEFAULT_NOTE_TYPES: NoteType[] = [
  {
    id: 'default-basic',
    name: 'Basic',
    isCloze: false,
    fields: [
      { id: 'f1', name: 'Front', description: 'Question or prompt' },
      { id: 'f2', name: 'Back', description: 'Answer or explanation' },
    ],
    templates: [
      {
        name: 'Card 1',
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
      },
    ],
    css: '.card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 20px; text-align: center; color: inherit; }',
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: 'default-reversed',
    name: 'Basic (and reversed card)',
    isCloze: false,
    fields: [
      { id: 'f1', name: 'Front', description: 'Front side prompt' },
      { id: 'f2', name: 'Back', description: 'Back side prompt' },
    ],
    templates: [
      {
        name: 'Card 1 (Front -> Back)',
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
      },
      {
        name: 'Card 2 (Back -> Front)',
        qfmt: '{{Back}}',
        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Front}}',
      },
    ],
    css: '.card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 20px; text-align: center; color: inherit; }',
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: 'default-cloze',
    name: 'Cloze',
    isCloze: true,
    fields: [
      { id: 'f1', name: 'Text', description: 'Text with {{c1::cloze deletion}} syntax' },
      { id: 'f2', name: 'Back Extra', description: 'Additional context or remarks' },
    ],
    templates: [
      {
        name: 'Cloze',
        qfmt: '{{cloze:Text}}',
        afmt: '{{cloze:Text}}\n\n<hr id="answer">\n\n{{Back Extra}}',
      },
    ],
    css: '.card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 20px; text-align: center; color: inherit; } .cloze { font-weight: bold; color: #007aff; }',
    updatedAt: Date.now(),
    deletedAt: null,
  },
];
