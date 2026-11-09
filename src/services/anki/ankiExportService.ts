import * as fflate from 'fflate';
import { getSql } from './sqlLoader';
import { db as defaultDb, type RecallDatabase } from '../../db/database';
import { MediaRepository } from '../../db/repositories/mediaRepository';
import { deckService } from '../deckService';
import { CardState } from '../../core/models/card';
import type { Deck, ReviewLog } from '../../core/models';
import type { AnkiExportOptions } from './types';

export class AnkiExportService {
  constructor(
    private db: RecallDatabase = defaultDb,
    private mediaRepo: MediaRepository = new MediaRepository(defaultDb)
  ) {}

  /**
   * Generates a fully Anki-compliant .apkg ZIP archive containing an SQLite collection.anki2
   * database, media JSON, and media files.
   */
  async exportPackage(options: AnkiExportOptions): Promise<{ blob: Blob; filename: string }> {
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);

    // 1. Determine target decks
    let targetDeckIds: string[] = [];
    let rootDeckName = 'Recall_Collection';

    if (options.deckId) {
      const rootDeck = await this.db.decks.get(options.deckId);
      if (rootDeck) {
        rootDeckName = rootDeck.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
      }
      targetDeckIds = await deckService.getSubdeckIds(options.deckId, true);
    } else {
      const allDecks = await this.db.decks.filter((d) => d.deletedAt === null).toArray();
      targetDeckIds = allDecks.map((d) => d.id);
    }

    const deckIdSet = new Set(targetDeckIds);

    // Fetch target decks
    const decks = await this.db.decks
      .filter((d) => d.deletedAt === null && deckIdSet.has(d.id))
      .toArray();

    // Fetch cards belonging to these decks
    const cards = await this.db.cards
      .filter((c) => c.deletedAt === null && deckIdSet.has(c.deckId))
      .toArray();

    // Fetch notes referenced by these cards
    const noteIdSet = new Set(cards.map((c) => c.noteId));
    const notes = await this.db.notes
      .filter((n) => n.deletedAt === null && noteIdSet.has(n.id))
      .toArray();

    // Fetch note types referenced by these notes
    const noteTypeIdSet = new Set(notes.map((n) => n.noteTypeId));
    const noteTypes = await this.db.noteTypes
      .filter((nt) => nt.deletedAt === null && noteTypeIdSet.has(nt.id))
      .toArray();

    // Fetch reviews if requested
    let reviews: ReviewLog[] = [];
    if (options.includeReviews) {
      const cardIdSet = new Set(cards.map((c) => c.id));
      reviews = await this.db.reviews
        .filter((r: ReviewLog) => r.deletedAt === null && cardIdSet.has(r.cardId))
        .toArray();
    }

    // 2. Build hierarchical deck names and integer IDs
    // Map Recall string ID -> integer Anki ID
    const recallDeckIdToAnkiId = new Map<string, number>();
    const ankiDecksJson: Record<string, any> = {};

    // Helper to compute full path e.g. "Languages::German::A1"
    const deckLookup = new Map<string, Deck>();
    const allDecksForHierarchy = await this.db.decks.filter((d) => d.deletedAt === null).toArray();
    for (const d of allDecksForHierarchy) {
      deckLookup.set(d.id, d);
    }

    const getFullDeckPath = (d: Deck): string => {
      const parts: string[] = [d.name];
      let curr = d;
      const visited = new Set<string>([d.id]);
      while (curr.parentId && deckLookup.has(curr.parentId)) {
        if (visited.has(curr.parentId)) break; // Cycle guard
        visited.add(curr.parentId);
        curr = deckLookup.get(curr.parentId)!;
        parts.unshift(curr.name);
      }
      return parts.join('::');
    };

    let nextDeckId = 1;
    // Always include Anki's Default deck 1
    ankiDecksJson['1'] = {
      id: 1,
      name: 'Default',
      desc: '',
      mod: nowSec,
      usn: -1,
      collapsed: false,
      browserCollapsed: false,
    };

    for (const deck of decks) {
      nextDeckId++;
      const ankiId = nextDeckId;
      recallDeckIdToAnkiId.set(deck.id, ankiId);
      const fullPath = getFullDeckPath(deck);

      ankiDecksJson[String(ankiId)] = {
        id: ankiId,
        name: fullPath,
        desc: deck.description || '',
        mod: Math.floor(deck.updatedAt / 1000),
        usn: -1,
        collapsed: false,
        browserCollapsed: false,
      };
    }

    // 3. Build NoteTypes (Anki Models)
    const recallNoteTypeIdToAnkiId = new Map<string, number>();
    const ankiModelsJson: Record<string, any> = {};
    let nextModelId = 1600000000000;

    for (const nt of noteTypes) {
      nextModelId++;
      const ankiId = nextModelId;
      recallNoteTypeIdToAnkiId.set(nt.id, ankiId);

      const flds = nt.fields.map((f, idx) => ({
        name: f.name,
        ord: idx,
        sticky: false,
        rtl: false,
        font: 'Arial',
        size: 20,
      }));

      const tmpls = nt.templates.map((t, idx) => ({
        name: t.name,
        ord: idx,
        qfmt: t.qfmt,
        afmt: t.afmt,
        did: null,
        bqfmt: '',
        bafmt: '',
      }));

      ankiModelsJson[String(ankiId)] = {
        id: ankiId,
        name: nt.name,
        type: nt.isCloze ? 1 : 0,
        mod: Math.floor(nt.updatedAt / 1000),
        usn: -1,
        sortf: 0,
        did: 1,
        tmpls,
        flds,
        css: nt.css || '.card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }',
      };
    }

    // 4. Map Notes to integer IDs and records
    const recallNoteIdToAnkiId = new Map<string, number>();
    const ankiNotes: Array<{
      id: number;
      guid: string;
      mid: number;
      mod: number;
      usn: number;
      tags: string;
      flds: string;
      sfld: string;
      csum: number;
    }> = [];

    let nextNoteId = 1700000000000;
    for (const note of notes) {
      nextNoteId++;
      const ankiId = nextNoteId;
      recallNoteIdToAnkiId.set(note.id, ankiId);

      const ankiMid = recallNoteTypeIdToAnkiId.get(note.noteTypeId) || nextModelId;
      const nt = noteTypes.find((t) => t.id === note.noteTypeId);
      const fieldNames = nt ? nt.fields.map((f) => f.name) : Object.keys(note.fieldValues);

      const fldValues = fieldNames.map((fn) => note.fieldValues[fn] ?? '');
      const fldsStr = fldValues.join('\x1f');
      const sfld = fldValues[0]?.replace(/<[^>]*>/g, '').trim() ?? '';

      // Compute simple 32-bit checksum from sfld
      let csum = 0;
      for (let i = 0; i < sfld.length; i++) {
        csum = (csum * 31 + sfld.charCodeAt(i)) & 0xffffffff;
      }
      if (csum < 0) csum += 0x100000000;

      // 10-char alphanumeric GUID
      const guid = note.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).padEnd(10, '0');

      ankiNotes.push({
        id: ankiId,
        guid,
        mid: ankiMid,
        mod: Math.floor(note.updatedAt / 1000),
        usn: -1,
        tags: note.tags.join(' '),
        flds: fldsStr,
        sfld,
        csum,
      });
    }

    // 5. Map Cards to integer IDs and records
    const recallCardIdToAnkiId = new Map<string, number>();
    const ankiCards: Array<{
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
      flags: number;
    }> = [];

    let nextCardId = 1800000000000;
    for (const card of cards) {
      const ankiNid = recallNoteIdToAnkiId.get(card.noteId);
      if (!ankiNid) continue;

      nextCardId++;
      const ankiId = nextCardId;
      recallCardIdToAnkiId.set(card.id, ankiId);

      const ankiDid = recallDeckIdToAnkiId.get(card.deckId) || 1;

      let type = 0; // 0=new, 1=learning, 2=review
      let queue = 0;
      if (card.isSuspended) {
        queue = -1;
      } else if (card.state === CardState.Review) {
        type = 2;
        queue = 2;
      } else if (card.state === CardState.Learning || card.state === CardState.Relearning) {
        type = 1;
        queue = 1;
      } else {
        type = 0;
        queue = 0;
      }

      // Anki review card due is days since col.crt
      const colCrtSec = nowSec - 86400 * 30; // 30 days ago
      let due = 0;
      if (type === 2) {
        due = Math.max(0, Math.floor((card.due - colCrtSec * 1000) / 86400000));
      } else if (type === 1) {
        due = Math.floor(card.due / 1000);
      } else {
        due = ankiCards.length + 1;
      }

      const ivl = Math.round(card.fsrs?.scheduled_days || 0);
      const factor = Math.round((11 - (card.fsrs?.difficulty || 5)) * 250);

      ankiCards.push({
        id: ankiId,
        nid: ankiNid,
        did: ankiDid,
        ord: card.templateIndex,
        mod: Math.floor(card.updatedAt / 1000),
        usn: -1,
        type,
        queue,
        due,
        ivl,
        factor,
        reps: card.fsrs?.reps || 0,
        lapses: card.fsrs?.lapses || 0,
        flags: card.isFlagged ? 1 : 0,
      });
    }

    // 6. Map Reviews
    const ankiRevlogs: Array<{
      id: number;
      cid: number;
      usn: number;
      ease: number;
      ivl: number;
      lastIvl: number;
      factor: number;
      time: number;
      type: number;
    }> = [];

    for (const rev of reviews) {
      const ankiCid = recallCardIdToAnkiId.get(rev.cardId);
      if (!ankiCid) continue;

      let ease = 3;
      if (rev.rating === 1) ease = 1;
      else if (rev.rating === 2) ease = 2;
      else if (rev.rating === 3) ease = 3;
      else if (rev.rating === 4) ease = 4;

      const type = rev.state === CardState.Learning ? 0 : 1;

      ankiRevlogs.push({
        id: rev.reviewTime,
        cid: ankiCid,
        usn: -1,
        ease,
        ivl: rev.scheduledDays,
        lastIvl: rev.lastElapsedDays,
        factor: 2500,
        time: rev.durationMs,
        type,
      });
    }

    // 7. Find referenced media files and extract from MediaRepository
    const referencedMediaFilenames = new Set<string>();
    if (options.includeMedia) {
      const mediaImgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
      const mediaAudioRegex = /\[sound:([^\]]+)\]/gi;

      for (const n of notes) {
        for (const val of Object.values(n.fieldValues)) {
          let match: RegExpExecArray | null;
          while ((match = mediaImgRegex.exec(val)) !== null) {
            const fn = match[1]?.trim();
            if (fn && !fn.startsWith('http') && !fn.startsWith('data:')) {
              referencedMediaFilenames.add(fn);
            }
          }
          while ((match = mediaAudioRegex.exec(val)) !== null) {
            const fn = match[1]?.trim();
            if (fn) referencedMediaFilenames.add(fn);
          }
        }
      }
    }

    const zipEntries: Record<string, Uint8Array> = {};
    const mediaJsonMap: Record<string, string> = {};

    let mediaIndex = 0;
    for (const filename of referencedMediaFilenames) {
      const item = await this.mediaRepo.getByFilename(filename);
      if (item && item.deletedAt === null) {
        let rawBytes: Uint8Array;
        if (item.data instanceof Uint8Array) {
          rawBytes = item.data;
        } else if (typeof item.data.arrayBuffer === 'function') {
          const buf = await item.data.arrayBuffer();
          rawBytes = new Uint8Array(buf);
        } else if ((item.data as any).buffer instanceof ArrayBuffer) {
          rawBytes = new Uint8Array((item.data as any).buffer);
        } else {
          rawBytes = new Uint8Array();
        }

        const key = String(mediaIndex);
        mediaJsonMap[key] = filename;
        zipEntries[key] = rawBytes;
        mediaIndex++;
      }
    }

    // 8. Build SQLite database using SQL.js
    const SQL = await getSql();
    const sqlDb = new SQL.Database();

    try {
      // Create Schema 11 Tables
      sqlDb.run(`
        CREATE TABLE col (
          id integer primary key,
          crt integer not null,
          mod integer not null,
          scm integer not null,
          ver integer not null,
          dty integer not null,
          usn integer not null,
          ls integer not null,
          conf text not null,
          models text not null,
          decks text not null,
          dconf text not null,
          tags text not null
        );
        CREATE TABLE notes (
          id integer primary key,
          guid text not null,
          mid integer not null,
          mod integer not null,
          usn integer not null,
          tags text not null,
          flds text not null,
          sfld text not null,
          csum integer,
          flags integer not null,
          data text not null
        );
        CREATE TABLE cards (
          id integer primary key,
          nid integer not null,
          did integer not null,
          ord integer not null,
          mod integer not null,
          usn integer not null,
          type integer not null,
          queue integer not null,
          due integer not null,
          ivl integer not null,
          factor integer not null,
          reps integer not null,
          lapses integer not null,
          left integer not null,
          odue integer not null,
          odid integer not null,
          flags integer not null,
          data text not null
        );
        CREATE TABLE revlog (
          id integer primary key,
          cid integer not null,
          usn integer not null,
          ease integer not null,
          ivl integer not null,
          lastIvl integer not null,
          factor integer not null,
          time integer not null,
          type integer not null
        );
        CREATE TABLE graves (
          usn integer not null,
          oid integer not null,
          type integer not null
        );
        CREATE INDEX ix_notes_usn on notes (usn);
        CREATE INDEX ix_cards_usn on cards (usn);
        CREATE INDEX ix_revlog_usn on revlog (usn);
        CREATE INDEX ix_cards_nid on cards (nid);
        CREATE INDEX ix_cards_sched on cards (did, queue, due);
        CREATE INDEX ix_revlog_cid on revlog (cid);
        CREATE INDEX ix_notes_csum on notes (csum);
      `);

      // Populate col table
      const confJson = JSON.stringify({
        nextPos: 1,
        estTimes: true,
        activeDecks: [1],
        sortType: 'noteFld',
        timeLim: 0,
        sortBackwards: false,
        addToCur: true,
        curDeck: 1,
        curModel: null,
        collapseTime: 1200,
      });

      const dconfJson = JSON.stringify({
        '1': {
          id: 1,
          name: 'Default',
          new: { delays: [1, 10], ints: [1, 4, 7], initialFactor: 2500, perDay: 20 },
          rev: { perDay: 200, ease4: 1.3, fuzz: 0.05, minSpace: 1, ivlFct: 1, maxIvl: 36500 },
          lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 0 },
          maxTaken: 60,
          timer: 0,
          autoplay: true,
          replayq: true,
          mod: 0,
          usn: 0,
        },
      });

      const colCrtSec = nowSec - 86400 * 30;
      const colStmt = sqlDb.prepare(
        'INSERT INTO col VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      colStmt.run([
        1,
        colCrtSec,
        now,
        now,
        11,
        0,
        0,
        0,
        confJson,
        JSON.stringify(ankiModelsJson),
        JSON.stringify(ankiDecksJson),
        dconfJson,
        '{}',
      ]);
      colStmt.free();

      // Populate notes table
      const noteStmt = sqlDb.prepare(
        'INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const n of ankiNotes) {
        noteStmt.run([
          n.id,
          n.guid,
          n.mid,
          n.mod,
          n.usn,
          n.tags,
          n.flds,
          n.sfld,
          n.csum,
          0,
          '',
        ]);
      }
      noteStmt.free();

      // Populate cards table
      const cardStmt = sqlDb.prepare(
        'INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const c of ankiCards) {
        cardStmt.run([
          c.id,
          c.nid,
          c.did,
          c.ord,
          c.mod,
          c.usn,
          c.type,
          c.queue,
          c.due,
          c.ivl,
          c.factor,
          c.reps,
          c.lapses,
          0,
          0,
          0,
          c.flags,
          '',
        ]);
      }
      cardStmt.free();

      // Populate revlog table
      const revStmt = sqlDb.prepare(
        'INSERT INTO revlog VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const r of ankiRevlogs) {
        revStmt.run([
          r.id,
          r.cid,
          r.usn,
          r.ease,
          r.ivl,
          r.lastIvl,
          r.factor,
          r.time,
          r.type,
        ]);
      }
      revStmt.free();

      // Export SQLite binary payload
      const sqliteBytes = sqlDb.export();
      zipEntries['collection.anki2'] = sqliteBytes;
    } finally {
      sqlDb.close();
    }

    // 9. Add media index JSON file
    zipEntries['media'] = fflate.strToU8(JSON.stringify(mediaJsonMap));

    // 10. Create .apkg ZIP archive using fflate
    const zippedBytes = fflate.zipSync(zipEntries);
    const blob = new Blob([zippedBytes], { type: 'application/zip' });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = options.filename || `${rootDeckName}_${dateStr}.apkg`;

    return { blob, filename };
  }
}

export const ankiExportService = new AnkiExportService();
