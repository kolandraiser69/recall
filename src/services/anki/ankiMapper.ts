import type {
  Deck,
  Note,
  NoteType,
  Card,
  ReviewLog,
  FieldDefinition,
  CardTemplate,
} from '../../core/models';
import { CardState, Rating } from '../../core/models/card';
import { DEFAULT_DECK_SETTINGS } from '../../core/models/deck';
import { DEFAULT_INITIAL_FSRS } from '../../db/repositories/cardRepository';
import { generateId } from '../../utils/id';
import type {
  ParsedAnkiCollection,
  AnkiImportOptions,
} from './types';

export interface MappedAnkiData {
  decks: Deck[];
  noteTypes: NoteType[];
  notes: Note[];
  cards: Card[];
  reviews: ReviewLog[];
  ankiDeckIdToRecallDeckId: Map<number | string, string>;
  ankiNoteIdToRecallNoteId: Map<number, string>;
  ankiCardIdToRecallCardId: Map<number, string>;
  warnings: string[];
}

export class AnkiMapper {
  /**
   * Maps parsed Anki database structures to native Recall domain models.
   *
   * @param parsed Parsed collection from AnkiParser
   * @param options User-selected import options and conflict strategies
   * @param existingDecks Currently existing Recall decks in database (for hierarchy & name conflict resolution)
   * @param existingNoteTypes Currently existing Recall note types in database
   */
  static mapToRecall(
    parsed: ParsedAnkiCollection,
    options: AnkiImportOptions,
    existingDecks: Deck[] = [],
    existingNoteTypes: NoteType[] = []
  ): MappedAnkiData {
    const warnings: string[] = [...parsed.warnings];
    const now = Date.now();

    // 1. Deck Mapping & Hierarchy Construction
    const ankiDeckIdToRecallDeckId = new Map<number | string, string>();
    const mappedDecks: Deck[] = [];

    // Filter decks if options.selectedDeckIds is provided
    const selectedDeckIdSet = options.selectedDeckIds
      ? new Set(options.selectedDeckIds.map(String))
      : null;

    // Existing decks lookup for 'merge' strategy
    const existingPathToDeckId = new Map<string, string>();
    const existingDeckNames = new Set<string>();
    for (const d of existingDecks) {
      if (d.deletedAt === null) {
        existingPathToDeckId.set(d.name, d.id);
        existingDeckNames.add(d.name);
      }
    }

    // Lookup for decks created during this import session
    const sessionPathToDeckId = new Map<string, string>();

    // Sort anki decks by name length so parents are processed before children
    const sortedAnkiDecks = Array.from(parsed.decks.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const ankiDeck of sortedAnkiDecks) {
      const ankiIdStr = String(ankiDeck.id);

      // If user selected specific decks, skip unselected ones unless they are ancestor paths
      if (selectedDeckIdSet && !selectedDeckIdSet.has(ankiIdStr)) {
        continue;
      }

      // Anki decks use "::" separator for nested hierarchy
      const segments = ankiDeck.name.split('::').map((s) => s.trim());
      let currentParentId: string | null = options.targetDeckId ?? null;
      let cumulativePath = '';

      for (let i = 0; i < segments.length; i++) {
        const segmentName = segments[i] ?? '';
        cumulativePath = cumulativePath ? `${cumulativePath}::${segmentName}` : segmentName;
        const isLeaf = i === segments.length - 1;

        // Check if created earlier in this session
        let targetId = sessionPathToDeckId.get(cumulativePath);

        if (!targetId && options.conflictStrategy === 'merge') {
          // In merge mode, reuse existing deck from database if path matches
          targetId = existingPathToDeckId.get(cumulativePath);
        }

        if (!targetId) {
          let finalName = segmentName;
          if (options.conflictStrategy === 'rename' && i === 0 && !currentParentId) {
            if (existingDeckNames.has(finalName)) {
              let counter = 1;
              while (existingDeckNames.has(`${segmentName} (${counter})`)) {
                counter++;
              }
              finalName = `${segmentName} (${counter})`;
              existingDeckNames.add(finalName);
            }
          }

          const newDeckId = generateId();
          const newDeck: Deck = {
            id: newDeckId,
            name: finalName,
            parentId: currentParentId,
            description: isLeaf && ankiDeck.desc ? ankiDeck.desc : '',
            settings: { ...DEFAULT_DECK_SETTINGS },
            order: mappedDecks.length,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          };

          mappedDecks.push(newDeck);
          sessionPathToDeckId.set(cumulativePath, newDeckId);
          targetId = newDeckId;
        }

        currentParentId = targetId ?? null;

        if (isLeaf && targetId) {
          ankiDeckIdToRecallDeckId.set(ankiDeck.id, targetId);
          ankiDeckIdToRecallDeckId.set(ankiIdStr, targetId);
        }
      }
    }

    // Ensure fallback deck if no deck mapped
    let fallbackDeckId = options.targetDeckId;
    if (!fallbackDeckId) {
      if (mappedDecks.length > 0 && mappedDecks[0]) {
        fallbackDeckId = mappedDecks[0].id;
      } else if (existingDecks.length > 0 && existingDecks[0]) {
        fallbackDeckId = existingDecks[0].id;
      } else {
        fallbackDeckId = generateId();
        const defaultDeck: Deck = {
          id: fallbackDeckId,
          name: 'Imported Deck',
          parentId: null,
          description: 'Imported from Anki',
          settings: { ...DEFAULT_DECK_SETTINGS },
          order: 0,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        mappedDecks.push(defaultDeck);
      }
    }

    // 2. NoteTypes Mapping
    const ankiModelIdToRecallNoteTypeId = new Map<number | string, string>();
    const mappedNoteTypes: NoteType[] = [];

    for (const [mId, rawModel] of parsed.models.entries()) {
      // Check if an existing note type matches name, fields, and template structure
      const matchingExisting = existingNoteTypes.find(
        (nt) =>
          nt.deletedAt === null &&
          nt.name.toLowerCase() === rawModel.name.toLowerCase() &&
          nt.fields.length === rawModel.flds.length &&
          nt.templates.length === rawModel.tmpls.length
      );

      if (matchingExisting) {
        ankiModelIdToRecallNoteTypeId.set(mId, matchingExisting.id);
        ankiModelIdToRecallNoteTypeId.set(String(mId), matchingExisting.id);
        continue;
      }

      const noteTypeId = generateId();
      const isCloze = rawModel.type === 1 || rawModel.name.toLowerCase().includes('cloze');

      const fields: FieldDefinition[] = rawModel.flds
        .slice()
        .sort((a, b) => a.ord - b.ord)
        .map((f, idx) => ({
          id: `f_${idx + 1}`,
          name: f.name || `Field ${idx + 1}`,
        }));

      const templates: CardTemplate[] = rawModel.tmpls
        .slice()
        .sort((a, b) => a.ord - b.ord)
        .map((t) => ({
          name: t.name || 'Card',
          qfmt: t.qfmt || '{{Front}}',
          afmt: t.afmt || '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
        }));

      const newNoteType: NoteType = {
        id: noteTypeId,
        name: rawModel.name || 'Imported Note Type',
        isCloze,
        fields: fields.length > 0 ? fields : [{ id: 'f_1', name: 'Front' }, { id: 'f_2', name: 'Back' }],
        templates: templates.length > 0 ? templates : [{ name: 'Card 1', qfmt: '{{Front}}', afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}' }],
        css: rawModel.css || '',
        updatedAt: now,
        deletedAt: null,
      };

      mappedNoteTypes.push(newNoteType);
      ankiModelIdToRecallNoteTypeId.set(mId, noteTypeId);
      ankiModelIdToRecallNoteTypeId.set(String(mId), noteTypeId);
    }

    // 3. Notes Mapping
    const ankiNoteIdToRecallNoteId = new Map<number, string>();
    const mappedNotes: Note[] = [];

    // Quick lookup for models by anki id
    for (const rawNote of parsed.notes) {
      const recallNoteTypeId =
        ankiModelIdToRecallNoteTypeId.get(rawNote.mid) ||
        ankiModelIdToRecallNoteTypeId.get(String(rawNote.mid));

      if (!recallNoteTypeId) {
        warnings.push(`Note ${rawNote.id} references unknown Note Type ${rawNote.mid}; skipping note.`);
        continue;
      }

      const rawModel = parsed.models.get(rawNote.mid) || parsed.models.get(String(rawNote.mid));
      const fieldNames = rawModel
        ? rawModel.flds.slice().sort((a, b) => a.ord - b.ord).map((f) => f.name)
        : [];

      // Split Anki field values by ASCII 31 (\x1f)
      const fieldValuesArray = rawNote.flds.split('\x1f');
      const fieldValues: Record<string, string> = {};

      fieldNames.forEach((name, idx) => {
        fieldValues[name] = fieldValuesArray[idx] ?? '';
      });

      // If more values than named fields, add them as extra
      if (fieldValuesArray.length > fieldNames.length) {
        for (let i = fieldNames.length; i < fieldValuesArray.length; i++) {
          fieldValues[`Field ${i + 1}`] = fieldValuesArray[i] ?? '';
        }
      }

      // Parse tags
      const tags = rawNote.tags
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const noteId = generateId();
      const createdAt = rawNote.mod > 0 ? rawNote.mod * 1000 : now;

      const note: Note = {
        id: noteId,
        noteTypeId: recallNoteTypeId,
        fieldValues,
        tags,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      };

      mappedNotes.push(note);
      ankiNoteIdToRecallNoteId.set(rawNote.id, noteId);
    }

    // 4. Cards & Scheduling Mapping
    const ankiCardIdToRecallCardId = new Map<number, string>();
    const mappedCards: Card[] = [];

    for (const rawCard of parsed.cards) {
      if (selectedDeckIdSet && !selectedDeckIdSet.has(String(rawCard.did))) {
        continue;
      }

      const recallNoteId = ankiNoteIdToRecallNoteId.get(rawCard.nid);
      if (!recallNoteId) {
        // Note was skipped or missing
        continue;
      }

      // Deck resolution
      let recallDeckId =
        ankiDeckIdToRecallDeckId.get(rawCard.did) ||
        ankiDeckIdToRecallDeckId.get(String(rawCard.did));

      if (!recallDeckId) {
        if (!selectedDeckIdSet) {
          recallDeckId = fallbackDeckId!;
        } else {
          continue;
        }
      }

      const cardId = generateId();
      let state = CardState.New;
      let isSuspended = false;
      const isFlagged = rawCard.flags > 0;
      let due = now;
      let fsrs = { ...DEFAULT_INITIAL_FSRS };

      if (options.importScheduling) {
        // Anki queue: -3 = user suspended, -2 = sibling suspended, -1 = learning, 0 = new, 1 = learning, 2 = review, 3 = day learn/relearn
        if (rawCard.queue === -1 || rawCard.queue === 1) {
          state = CardState.Learning;
        } else if (rawCard.queue === 2) {
          state = CardState.Review;
        } else if (rawCard.queue === 3) {
          state = CardState.Relearning;
        } else if (rawCard.queue < 0) {
          isSuspended = true;
          state = rawCard.type === 2 ? CardState.Review : CardState.New;
        } else {
          state = CardState.New;
        }

        // Anki due calculation:
        // Review cards (queue == 2): due is days since collection creation (col.crt)
        if (state === CardState.Review && rawCard.due > 0) {
          const colCrtSec = parsed.creationTime > 0 ? parsed.creationTime : Math.floor(now / 1000);
          due = (colCrtSec + rawCard.due * 86400) * 1000;
        } else if (state === CardState.Learning && rawCard.due > 0) {
          // Learning cards: due is unix timestamp in seconds
          due = rawCard.due * 1000;
        } else {
          due = now;
        }

        // Anki ease factor (e.g. 2500 = 250%) mapped to FSRS Difficulty 1..10
        // Lower factor = harder card = higher difficulty
        const factor = rawCard.factor > 0 ? rawCard.factor : 2500;
        const difficulty = Math.max(1, Math.min(10, 11 - factor / 250));
        const stability = rawCard.ivl > 0 ? Math.max(0.1, rawCard.ivl) : 1.0;

        fsrs = {
          stability,
          difficulty,
          elapsed_days: 0,
          scheduled_days: rawCard.ivl > 0 ? rawCard.ivl : 0,
          reps: rawCard.reps > 0 ? rawCard.reps : 0,
          lapses: rawCard.lapses > 0 ? rawCard.lapses : 0,
          state,
          last_review: rawCard.mod > 0 ? rawCard.mod * 1000 : undefined,
        };
      }

      const card: Card = {
        id: cardId,
        noteId: recallNoteId,
        deckId: recallDeckId,
        templateIndex: rawCard.ord,
        state,
        due,
        fsrs,
        isSuspended: isSuspended ? true : undefined,
        isFlagged: isFlagged ? true : undefined,
        createdAt: rawCard.mod > 0 ? rawCard.mod * 1000 : now,
        updatedAt: now,
        deletedAt: null,
      };

      mappedCards.push(card);
      ankiCardIdToRecallCardId.set(rawCard.id, cardId);
    }

    // 5. Reviews Mapping
    const mappedReviews: ReviewLog[] = [];
    if (options.importReviews && parsed.revlog.length > 0) {
      for (const rawRev of parsed.revlog) {
        const recallCardId = ankiCardIdToRecallCardId.get(rawRev.cid);
        if (!recallCardId) {
          continue; // Card wasn't imported
        }

        // Map Anki ease (1: Again, 2: Hard, 3: Good, 4: Easy)
        let rating = Rating.Good;
        if (rawRev.ease === 1) rating = Rating.Again;
        else if (rawRev.ease === 2) rating = Rating.Hard;
        else if (rawRev.ease === 3) rating = Rating.Good;
        else if (rawRev.ease === 4) rating = Rating.Easy;

        // Review type: 0=learn, 1=review, 2=relearn, 3=cram
        let state = CardState.Review;
        if (rawRev.type === 0) state = CardState.Learning;
        else if (rawRev.type === 2) state = CardState.Relearning;

        const scheduledDays = rawRev.ivl > 0 ? rawRev.ivl : 0;
        const elapsedDays = rawRev.lastIvl > 0 ? rawRev.lastIvl : 0;
        const stability = Math.max(1, scheduledDays > 0 ? scheduledDays : 1);

        const reviewLog: ReviewLog = {
          id: generateId(),
          cardId: recallCardId,
          rating,
          state,
          due: rawRev.id,
          stability,
          difficulty: 5.0, // Neutral baseline for historical logs
          elapsedDays,
          lastElapsedDays: elapsedDays,
          scheduledDays,
          reviewTime: rawRev.id,
          durationMs: rawRev.time > 0 ? rawRev.time : 0,
          deletedAt: null,
        };

        mappedReviews.push(reviewLog);
      }
    }

    // Only return notes that have at least one card imported (if cards exist in collection)
    const activeNoteIds = new Set(mappedCards.map((c) => c.noteId));
    const finalNotes = mappedCards.length > 0 ? mappedNotes.filter((n) => activeNoteIds.has(n.id)) : mappedNotes;

    return {
      decks: mappedDecks,
      noteTypes: mappedNoteTypes,
      notes: finalNotes,
      cards: mappedCards,
      reviews: mappedReviews,
      ankiDeckIdToRecallDeckId,
      ankiNoteIdToRecallNoteId,
      ankiCardIdToRecallCardId,
      warnings,
    };
  }
}
