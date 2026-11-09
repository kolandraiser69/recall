import { describe, it, expect, beforeEach } from 'vitest';
import * as fflate from 'fflate';
import { RecallDatabase } from '../../src/db/database';
import { MediaRepository } from '../../src/db/repositories/mediaRepository';
import { AnkiImportService } from '../../src/services/anki/ankiImportService';
import { AnkiExportService } from '../../src/services/anki/ankiExportService';
import { AnkiParser } from '../../src/services/anki/ankiParser';
import { CardState, Rating } from '../../src/core/models/card';
import { DEFAULT_DECK_SETTINGS } from '../../src/core/models/deck';
import { getSql } from '../../src/services/anki/sqlLoader';

describe('Anki Import & Export Roundtrip System', () => {
  let db: RecallDatabase;
  let mediaRepo: MediaRepository;
  let importService: AnkiImportService;
  let exportService: AnkiExportService;

  beforeEach(async () => {
    db = new RecallDatabase(`test_anki_roundtrip_${Date.now()}_${Math.random()}`);
    await db.initialize();
    mediaRepo = new MediaRepository(db);
    importService = new AnkiImportService(db, mediaRepo);
    exportService = new AnkiExportService(db, mediaRepo);
  });

  it('should reject invalid or non-zip archives with descriptive error', async () => {
    const invalidData = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(AnkiParser.parseAnkiPackage(invalidData)).rejects.toThrow(
      /Failed to read \.apkg archive/
    );
  });

  it('should reject zip archives missing collection.anki2', async () => {
    const emptyZip = fflate.zipSync({
      'some_file.txt': fflate.strToU8('not a database'),
    });
    await expect(AnkiParser.parseAnkiPackage(emptyZip)).rejects.toThrow(
      /No collection database/
    );
  });

  it('should successfully export, inspect, import, and roundtrip a Recall collection', async () => {
    // 1. Seed initial data in Recall database
    const parentDeck = {
      id: 'deck-languages',
      name: 'Languages',
      parentId: null,
      description: 'Language learning material',
      settings: { ...DEFAULT_DECK_SETTINGS },
      order: 0,
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000,
      deletedAt: null,
    };

    const childDeck = {
      id: 'deck-german-a1',
      name: 'German A1',
      parentId: 'deck-languages',
      description: 'German vocabulary',
      settings: { ...DEFAULT_DECK_SETTINGS },
      order: 1,
      createdAt: Date.now() - 50000,
      updatedAt: Date.now() - 50000,
      deletedAt: null,
    };

    await db.decks.bulkPut([parentDeck, childDeck]);

    const noteType = {
      id: 'nt-vocab',
      name: 'Vocab Note Type',
      isCloze: false,
      fields: [
        { id: 'f_1', name: 'German' },
        { id: 'f_2', name: 'English' },
        { id: 'f_3', name: 'Example' },
      ],
      templates: [
        {
          name: 'Card 1',
          qfmt: '{{German}}',
          afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{English}}<br><em>{{Example}}</em>',
        },
      ],
      css: '.card { font-family: sans-serif; text-align: center; }',
      updatedAt: Date.now(),
      deletedAt: null,
    };

    await db.noteTypes.put(noteType);

    // Save a media item
    const mediaBlob = new Blob(['fake image content'], { type: 'image/png' });
    await mediaRepo.save({
      filename: 'haus.png',
      mimeType: 'image/png',
      data: mediaBlob,
    });

    const note1 = {
      id: 'note-1',
      noteTypeId: 'nt-vocab',
      fieldValues: {
        German: 'das Haus <img src="haus.png">',
        English: 'house',
        Example: 'Das Haus ist groß. [sound:haus.mp3]',
      },
      tags: ['vocab', 'a1', 'nouns'],
      createdAt: Date.now() - 20000,
      updatedAt: Date.now() - 20000,
      deletedAt: null,
    };

    const note2 = {
      id: 'note-2',
      noteTypeId: 'nt-vocab',
      fieldValues: {
        German: 'der Baum',
        English: 'tree',
        Example: 'Der Baum ist grün.',
      },
      tags: ['vocab', 'nature'],
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
      deletedAt: null,
    };

    await db.notes.bulkPut([note1, note2]);

    const card1 = {
      id: 'card-1',
      noteId: 'note-1',
      deckId: 'deck-german-a1',
      templateIndex: 0,
      state: CardState.Review,
      due: Date.now() + 86400000 * 3, // due in 3 days
      fsrs: {
        stability: 3.5,
        difficulty: 4.2,
        elapsed_days: 2,
        scheduled_days: 3,
        reps: 2,
        lapses: 0,
        state: CardState.Review,
      },
      isFlagged: true,
      createdAt: Date.now() - 20000,
      updatedAt: Date.now() - 10000,
      deletedAt: null,
    };

    const card2 = {
      id: 'card-2',
      noteId: 'note-2',
      deckId: 'deck-german-a1',
      templateIndex: 0,
      state: CardState.New,
      due: Date.now(),
      fsrs: {
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: CardState.New,
      },
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
      deletedAt: null,
    };

    await db.cards.bulkPut([card1, card2]);

    const reviewLog1 = {
      id: 'rev-1',
      cardId: 'card-1',
      rating: Rating.Good,
      state: CardState.Review,
      due: Date.now() - 86400000,
      stability: 2.0,
      difficulty: 4.5,
      elapsedDays: 1,
      lastElapsedDays: 0,
      scheduledDays: 2,
      reviewTime: Date.now() - 86400000,
      durationMs: 4200,
      deletedAt: null,
    };

    await db.reviews.put(reviewLog1);

    // 2. Export package to .apkg
    const exportResult = await exportService.exportPackage({
      includeMedia: true,
      includeReviews: true,
    });

    expect(exportResult.blob).toBeInstanceOf(Blob);
    expect(exportResult.blob.size).toBeGreaterThan(1000);
    expect(exportResult.filename).toMatch(/\.apkg$/);

    // 3. Inspect package
    const manifest = await importService.inspectPackage(exportResult.blob, exportResult.filename);
    expect(manifest.fileName).toBe(exportResult.filename);
    expect(manifest.noteCount).toBe(2);
    expect(manifest.cardCount).toBe(2);
    expect(manifest.revlogCount).toBe(1);
    expect(manifest.mediaCount).toBe(1);
    expect(manifest.mediaFilenames).toContain('haus.png');

    // Verify hierarchical deck name in manifest
    const germanDeckManifest = manifest.decks.find((d) => d.name.includes('German A1'));
    expect(germanDeckManifest).toBeDefined();
    expect(germanDeckManifest?.name).toBe('Languages::German A1');

    // 4. Import the package into a fresh database
    const targetDb = new RecallDatabase(`test_anki_imported_${Date.now()}_${Math.random()}`);
    await targetDb.initialize();
    const targetMediaRepo = new MediaRepository(targetDb);
    const targetImportService = new AnkiImportService(targetDb, targetMediaRepo);

    const importResult = await targetImportService.executeImport(exportResult.blob, {
      importMedia: true,
      importReviews: true,
      importScheduling: true,
      conflictStrategy: 'rename',
    });

    expect(importResult.notes.length).toBe(2);
    expect(importResult.cards.length).toBe(2);
    expect(importResult.reviews.length).toBe(1);
    expect(importResult.mediaExtracted).toBe(1);

    // Verify database contents in targetDb
    const importedDecks = await targetDb.decks.toArray();
    expect(importedDecks.length).toBeGreaterThanOrEqual(2);

    const importedNotes = await targetDb.notes.toArray();
    expect(importedNotes.length).toBe(2);
    expect(importedNotes.some((n) => n.fieldValues['German']?.includes('das Haus'))).toBe(true);
    expect(importedNotes.some((n) => n.fieldValues['German']?.includes('der Baum'))).toBe(true);

    const importedCards = await targetDb.cards.toArray();
    expect(importedCards.length).toBe(2);

    const reviewCard = importedCards.find((c) => c.state === CardState.Review);
    expect(reviewCard).toBeDefined();
    expect(reviewCard?.fsrs.scheduled_days).toBe(3);

    const importedReviews = await targetDb.reviews.toArray();
    expect(importedReviews.length).toBe(1);
    expect(importedReviews[0]?.rating).toBe(Rating.Good);

    // Verify media persistence in targetDb
    const importedMedia = await targetMediaRepo.getByFilename('haus.png');
    expect(importedMedia).toBeDefined();
    expect(importedMedia?.mimeType).toBe('image/png');
  });

  it('should support cloze deletion note types and templates', async () => {
    const SQL = await getSql();
    const sqlDb = new SQL.Database();

    // Create minimal schema 11 with cloze note type
    sqlDb.run(`
      CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text);
      CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld text, csum integer, flags integer, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text);
      CREATE TABLE revlog (id integer primary key, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    `);

    const models = {
      '1': {
        id: 1,
        name: 'Cloze Note',
        type: 1, // cloze
        flds: [{ name: 'Text', ord: 0 }, { name: 'Extra', ord: 1 }],
        tmpls: [{ name: 'Cloze', ord: 0, qfmt: '{{cloze:Text}}', afmt: '{{cloze:Text}}<br>{{Extra}}' }],
        css: '',
      },
    };

    const decks = {
      '1': { id: 1, name: 'Default', desc: '' },
      '2': { id: 2, name: 'Medical::Anatomy', desc: 'Anatomy notes' },
    };

    sqlDb.run('INSERT INTO col VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      1, 1600000000, 1600000000, 1600000000, 11, 0, 0, 0, '{}',
      JSON.stringify(models), JSON.stringify(decks), '{}', '{}'
    ]);

    // Insert note with two cloze deletions
    sqlDb.run('INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      101, 'g123456789', 1, 1600000000, -1, 'anatomy', 'The {{c1::heart}} pumps {{c2::blood}}.\x1fCardiovascular system', 'The heart pumps blood.', 0, 0, ''
    ]);

    // Insert two cards (ord 0 for c1, ord 1 for c2)
    sqlDb.run('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      201, 101, 2, 0, 1600000000, -1, 0, 0, 1, 0, 2500, 0, 0, 0, 0, 0, 0, ''
    ]);
    sqlDb.run('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      202, 101, 2, 1, 1600000000, -1, 0, 0, 2, 0, 2500, 0, 0, 0, 0, 0, 0, ''
    ]);

    const sqliteBytes = sqlDb.export();
    sqlDb.close();

    const zipBytes = fflate.zipSync({
      'collection.anki2': sqliteBytes,
      media: fflate.strToU8('{}'),
    });

    const parsed = await AnkiParser.parseAnkiPackage(zipBytes);
    expect(parsed.notes.length).toBe(1);
    expect(parsed.cards.length).toBe(2);

    const importResult = await importService.executeImport(zipBytes, {
      importMedia: true,
      importReviews: false,
      importScheduling: false,
      conflictStrategy: 'merge',
    });

    expect(importResult.notes.length).toBe(1);
    expect(importResult.cards.length).toBe(2);
    expect(importResult.noteTypes[0]?.isCloze).toBe(true);

    const cards = await db.cards.toArray();
    expect(cards.length).toBe(2);
    expect(cards.some((c) => c.templateIndex === 0)).toBe(true);
    expect(cards.some((c) => c.templateIndex === 1)).toBe(true);
  });

  it('should support selective deck import by selectedDeckIds', async () => {
    const SQL = await getSql();
    const sqlDb = new SQL.Database();

    sqlDb.run(`
      CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text);
      CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld text, csum integer, flags integer, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text);
      CREATE TABLE revlog (id integer primary key, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    `);

    const models = {
      '1': {
        id: 1,
        name: 'Basic',
        type: 0,
        flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }],
        tmpls: [{ name: 'Card 1', ord: 0, qfmt: '{{Front}}', afmt: '{{Back}}' }],
        css: '',
      },
    };

    const decks = {
      '10': { id: 10, name: 'Deck A', desc: '' },
      '20': { id: 20, name: 'Deck B', desc: '' },
    };

    sqlDb.run('INSERT INTO col VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      1, 1600000000, 1600000000, 1600000000, 11, 0, 0, 0, '{}',
      JSON.stringify(models), JSON.stringify(decks), '{}', '{}'
    ]);

    sqlDb.run('INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      1, 'guid1', 1, 1600000000, -1, '', 'Note in A\x1fAnswer A', 'Note in A', 0, 0, ''
    ]);
    sqlDb.run('INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      2, 'guid2', 1, 1600000000, -1, '', 'Note in B\x1fAnswer B', 'Note in B', 0, 0, ''
    ]);

    sqlDb.run('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      101, 1, 10, 0, 1600000000, -1, 0, 0, 1, 0, 2500, 0, 0, 0, 0, 0, 0, ''
    ]);
    sqlDb.run('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      102, 2, 20, 0, 1600000000, -1, 0, 0, 2, 0, 2500, 0, 0, 0, 0, 0, 0, ''
    ]);

    const sqliteBytes = sqlDb.export();
    sqlDb.close();

    const zipBytes = fflate.zipSync({
      'collection.anki2': sqliteBytes,
      media: fflate.strToU8('{}'),
    });

    // Import ONLY Deck A (id: 10)
    const result = await importService.executeImport(zipBytes, {
      selectedDeckIds: [10],
      importMedia: false,
      importReviews: false,
      importScheduling: false,
      conflictStrategy: 'rename',
    });

    // Only Deck A and its note/card should be imported
    expect(result.decks.some((d) => d.name === 'Deck A')).toBe(true);
    expect(result.decks.some((d) => d.name === 'Deck B')).toBe(false);
    expect(result.cards.length).toBe(1);
    expect(result.notes.length).toBe(1);
    expect(result.notes[0]?.fieldValues['Front']).toBe('Note in A');
  });

  it('should handle deck name conflicts by appending counter when conflictStrategy is rename', async () => {
    // Pre-create a deck named "Geography"
    await db.decks.put({
      id: 'existing-geo',
      name: 'Geography',
      parentId: null,
      description: 'Existing geography deck',
      settings: { ...DEFAULT_DECK_SETTINGS },
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    });

    const SQL = await getSql();
    const sqlDb = new SQL.Database();
    sqlDb.run(`
      CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text);
      CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld text, csum integer, flags integer, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text);
      CREATE TABLE revlog (id integer primary key, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    `);

    const models = {
      '1': {
        id: 1,
        name: 'Basic',
        type: 0,
        flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }],
        tmpls: [{ name: 'Card 1', ord: 0, qfmt: '{{Front}}', afmt: '{{Back}}' }],
        css: '',
      },
    };

    const decks = {
      '1': { id: 1, name: 'Geography', desc: 'Imported geography' },
    };

    sqlDb.run('INSERT INTO col VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      1, 1600000000, 1600000000, 1600000000, 11, 0, 0, 0, '{}',
      JSON.stringify(models), JSON.stringify(decks), '{}', '{}'
    ]);

    sqlDb.run('INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      1, 'geo1', 1, 1600000000, -1, '', 'Capital of France?\x1fParis', 'Capital', 0, 0, ''
    ]);

    sqlDb.run('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      11, 1, 1, 0, 1600000000, -1, 0, 0, 1, 0, 2500, 0, 0, 0, 0, 0, 0, ''
    ]);

    const sqliteBytes = sqlDb.export();
    sqlDb.close();

    const zipBytes = fflate.zipSync({
      'collection.anki2': sqliteBytes,
      media: fflate.strToU8('{}'),
    });

    const result = await importService.executeImport(zipBytes, {
      importMedia: false,
      importReviews: false,
      importScheduling: false,
      conflictStrategy: 'rename',
    });

    expect(result.decks.length).toBe(1);
    expect(result.decks[0]?.name).toBe('Geography (1)');
  });
});
