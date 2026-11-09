import * as fflate from 'fflate';
import { getSql } from './sqlLoader';
import type {
  ParsedAnkiCollection,
  AnkiPackageManifest,
  RawAnkiDeck,
  RawAnkiModel,
  RawAnkiNote,
  RawAnkiCard,
  RawAnkiRevlog,
  AnkiDeckManifest,
  AnkiNoteTypeManifest,
} from './types';

export class AnkiParser {
  /**
   * Unzips the .apkg file and extracts the SQLite database, media JSON, and media blobs.
   */
  static async parseAnkiPackage(data: Uint8Array): Promise<ParsedAnkiCollection> {
    const warnings: string[] = [];
    const unsupportedFeatures: string[] = [];

    // 1. Unzip the .apkg archive
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = fflate.unzipSync(data);
    } catch (err) {
      throw new Error(
        `Failed to read .apkg archive: ${err instanceof Error ? err.message : 'Invalid or corrupted ZIP file'}`
      );
    }

    if (!unzipped || Object.keys(unzipped).length === 0) {
      throw new Error('Invalid Anki package: The archive is empty.');
    }

    // 2. Locate SQLite database file
    let dbBytes = unzipped['collection.anki2'];
    if (!dbBytes) {
      dbBytes = unzipped['collection.anki21'];
    }

    if (!dbBytes) {
      if (unzipped['collection.anki21b']) {
        throw new Error(
          'This package uses Zstandard compression (collection.anki21b). Please export from Anki with "Support older Anki versions" enabled.'
        );
      }
      throw new Error('Invalid Anki package: No collection database (collection.anki2 or collection.anki21) found.');
    }

    // 3. Locate media mapping file
    const mediaMap: Record<string, string> = {};
    const mediaJsonBytes = unzipped['media'];
    if (mediaJsonBytes) {
      try {
        const mediaJsonStr = fflate.strFromU8(mediaJsonBytes);
        const parsedMedia = JSON.parse(mediaJsonStr);
        if (typeof parsedMedia === 'object' && parsedMedia !== null) {
          Object.assign(mediaMap, parsedMedia);
        }
      } catch (e) {
        warnings.push(`Warning: Media index could not be parsed (${e instanceof Error ? e.message : 'Invalid JSON'}).`);
      }
    }

    // 4. Initialize SQL.js and open SQLite database
    const SQL = await getSql();
    let db;
    try {
      db = new SQL.Database(dbBytes);
    } catch (err) {
      throw new Error(
        `Corrupted Anki database: Failed to open SQLite collection (${err instanceof Error ? err.message : String(err)})`
      );
    }

    try {
      // 5. Query collection metadata
      let schemaVersion = 11;
      let creationTime = Math.floor(Date.now() / 1000);
      const modelsMap = new Map<number | string, RawAnkiModel>();
      const decksMap = new Map<number | string, RawAnkiDeck>();

      try {
        const colRes = db.exec('SELECT ver, crt, models, decks FROM col');
        const colRows = colRes[0]?.values;
        if (colRows && colRows.length > 0) {
          const row = colRows[0];
          if (row) {
            schemaVersion = Number(row[0]) || 11;
            creationTime = Number(row[1]) || creationTime;

            // Parse Models
            const rawModelsStr = row[2];
            if (typeof rawModelsStr === 'string' && rawModelsStr.trim().length > 0) {
              try {
                const parsedModels = JSON.parse(rawModelsStr);
                for (const [id, m] of Object.entries(parsedModels)) {
                  const model = m as any;
                  modelsMap.set(id, {
                    id: model.id ?? id,
                    name: model.name ?? 'Untitled Note Type',
                    type: model.type ?? 0,
                    flds: Array.isArray(model.flds)
                      ? model.flds.map((f: any) => ({ name: f.name ?? '', ord: f.ord ?? 0 }))
                      : [],
                    tmpls: Array.isArray(model.tmpls)
                      ? model.tmpls.map((t: any) => ({
                          name: t.name ?? 'Card',
                          ord: t.ord ?? 0,
                          qfmt: t.qfmt ?? '',
                          afmt: t.afmt ?? '',
                          bafmt: t.bafmt,
                          bqfmt: t.bqfmt,
                        }))
                      : [],
                    css: model.css ?? '',
                  });
                }
              } catch (err) {
                warnings.push(`Failed to parse models JSON: ${err instanceof Error ? err.message : String(err)}`);
              }
            }

            // Parse Decks
            const rawDecksStr = row[3];
            if (typeof rawDecksStr === 'string' && rawDecksStr.trim().length > 0) {
              try {
                const parsedDecks = JSON.parse(rawDecksStr);
                for (const [id, d] of Object.entries(parsedDecks)) {
                  const deck = d as any;
                  decksMap.set(id, {
                    id: deck.id ?? id,
                    name: deck.name ?? 'Default',
                    desc: deck.desc ?? '',
                  });
                }
              } catch (err) {
                warnings.push(`Failed to parse decks JSON: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
          }
        }
      } catch (err) {
        warnings.push(`Error reading col table: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Fallback: Check if newer schemas have a dedicated `decks` table
      if (decksMap.size === 0) {
        try {
          const hasDecksTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='decks'");
          if (hasDecksTable.length > 0 && (hasDecksTable[0]?.values.length ?? 0) > 0) {
            const decksRes = db.exec('SELECT id, name FROM decks');
            const decksValues = decksRes[0]?.values ?? [];
            for (const row of decksValues) {
              const id = String(row[0]);
              const name = String(row[1]);
              decksMap.set(id, { id, name });
            }
          }
        } catch {
          // Ignore table check failure
        }
      }

      // Fallback: Ensure at least one default deck if empty
      if (decksMap.size === 0) {
        decksMap.set('1', { id: '1', name: 'Default' });
      }

      // 6. Query Notes
      const notes: RawAnkiNote[] = [];
      try {
        const notesRes = db.exec('SELECT id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data FROM notes');
        const notesValues = notesRes[0]?.values ?? [];
        for (const row of notesValues) {
          notes.push({
            id: Number(row[0]),
            guid: String(row[1] ?? ''),
            mid: Number(row[2]),
            mod: Number(row[3] ?? 0),
            usn: Number(row[4] ?? 0),
            tags: String(row[5] ?? ''),
            flds: String(row[6] ?? ''),
            sfld: String(row[7] ?? ''),
            csum: Number(row[8] ?? 0),
            flags: Number(row[9] ?? 0),
            data: String(row[10] ?? ''),
          });
        }
      } catch (err) {
        warnings.push(`Error reading notes: ${err instanceof Error ? err.message : String(err)}`);
      }

      // 7. Query Cards
      const cards: RawAnkiCard[] = [];
      try {
        const cardsRes = db.exec(
          'SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data FROM cards'
        );
        const cardsValues = cardsRes[0]?.values ?? [];
        for (const row of cardsValues) {
          cards.push({
            id: Number(row[0]),
            nid: Number(row[1]),
            did: Number(row[2]),
            ord: Number(row[3] ?? 0),
            mod: Number(row[4] ?? 0),
            usn: Number(row[5] ?? 0),
            type: Number(row[6] ?? 0),
            queue: Number(row[7] ?? 0),
            due: Number(row[8] ?? 0),
            ivl: Number(row[9] ?? 0),
            factor: Number(row[10] ?? 2500),
            reps: Number(row[11] ?? 0),
            lapses: Number(row[12] ?? 0),
            left: Number(row[13] ?? 0),
            odue: Number(row[14] ?? 0),
            odid: Number(row[15] ?? 0),
            flags: Number(row[16] ?? 0),
            data: String(row[17] ?? ''),
          });
        }
      } catch (err) {
        warnings.push(`Error reading cards: ${err instanceof Error ? err.message : String(err)}`);
      }

      // 8. Query Revlog
      const revlog: RawAnkiRevlog[] = [];
      try {
        const hasRevlog = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='revlog'");
        if (hasRevlog.length > 0 && (hasRevlog[0]?.values.length ?? 0) > 0) {
          const revlogRes = db.exec(
            'SELECT id, cid, usn, ease, ivl, lastIvl, factor, time, type FROM revlog'
          );
          const revlogValues = revlogRes[0]?.values ?? [];
          for (const row of revlogValues) {
            revlog.push({
              id: Number(row[0]),
              cid: Number(row[1]),
              usn: Number(row[2] ?? 0),
              ease: Number(row[3] ?? 1),
              ivl: Number(row[4] ?? 0),
              lastIvl: Number(row[5] ?? 0),
              factor: Number(row[6] ?? 0),
              time: Number(row[7] ?? 0),
              type: Number(row[8] ?? 0),
            });
          }
        }
      } catch (err) {
        warnings.push(`Error reading revlog: ${err instanceof Error ? err.message : String(err)}`);
      }

      // 9. Check for JavaScript in templates
      for (const model of modelsMap.values()) {
        const hasScript =
          model.tmpls.some((t) => /<script\b/i.test(t.qfmt) || /<script\b/i.test(t.afmt)) ||
          /<script\b/i.test(model.css);
        if (hasScript) {
          unsupportedFeatures.push(
            `Note type "${model.name}" contains JavaScript in card templates. Scripts will be disabled for security.`
          );
        }
      }

      return {
        schemaVersion,
        creationTime,
        models: modelsMap,
        decks: decksMap,
        notes,
        cards,
        revlog,
        mediaMap,
        zipFiles: unzipped,
        warnings,
        unsupportedFeatures,
      };
    } finally {
      db.close();
    }
  }

  /**
   * Fast inspection to produce a user-facing AnkiPackageManifest for the import preview.
   */
  static async inspectPackage(
    data: Uint8Array,
    fileName: string,
    fileSize: number
  ): Promise<AnkiPackageManifest> {
    const parsed = await this.parseAnkiPackage(data);

    // Calculate card and note counts per deck
    const deckNoteCounts = new Map<number | string, Set<number>>();
    const deckCardCounts = new Map<number | string, number>();

    for (const card of parsed.cards) {
      deckCardCounts.set(card.did, (deckCardCounts.get(card.did) ?? 0) + 1);
      let noteSet = deckNoteCounts.get(card.did);
      if (!noteSet) {
        noteSet = new Set<number>();
        deckNoteCounts.set(card.did, noteSet);
      }
      noteSet.add(card.nid);
    }

    const deckManifests: AnkiDeckManifest[] = [];
    for (const [id, deck] of parsed.decks.entries()) {
      // Don't hide empty decks, but calculate counts
      deckManifests.push({
        id,
        name: deck.name,
        cardCount: deckCardCounts.get(Number(id)) ?? deckCardCounts.get(String(id)) ?? 0,
        noteCount: (deckNoteCounts.get(Number(id)) ?? deckNoteCounts.get(String(id)))?.size ?? 0,
      });
    }

    // Sort decks by hierarchy name
    deckManifests.sort((a, b) => a.name.localeCompare(b.name));

    const noteTypeManifests: AnkiNoteTypeManifest[] = [];
    for (const [id, model] of parsed.models.entries()) {
      noteTypeManifests.push({
        id,
        name: model.name,
        fieldCount: model.flds.length,
        templateCount: model.tmpls.length,
      });
    }

    const mediaFilenames = Object.values(parsed.mediaMap);

    return {
      fileName,
      fileSize,
      schemaVersion: parsed.schemaVersion,
      decks: deckManifests,
      noteTypes: noteTypeManifests,
      noteCount: parsed.notes.length,
      cardCount: parsed.cards.length,
      revlogCount: parsed.revlog.length,
      mediaCount: mediaFilenames.length,
      mediaFilenames,
      warnings: parsed.warnings,
      unsupportedFeatures: parsed.unsupportedFeatures,
    };
  }
}
