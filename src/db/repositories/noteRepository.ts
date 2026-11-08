import type { RecallDatabase } from '../database';
import type { Note } from '../../core/models/note';
import { noteSchema } from '../../core/validation/note.schema';
import { generateId } from '../../utils/id';

export class NoteRepository {
  constructor(private db: RecallDatabase) {}

  async getById(id: string): Promise<Note | undefined> {
    return this.db.notes.get(id);
  }

  async getAll(includeDeleted = false): Promise<Note[]> {
    if (includeDeleted) {
      return this.db.notes.toArray();
    }
    return this.db.notes.filter((note) => note.deletedAt === null).toArray();
  }

  async getByNoteType(noteTypeId: string, includeDeleted = false): Promise<Note[]> {
    return this.db.notes
      .where('noteTypeId')
      .equals(noteTypeId)
      .filter((note) => includeDeleted || note.deletedAt === null)
      .toArray();
  }

  async create(data: {
    id?: string;
    noteTypeId: string;
    fieldValues: Record<string, string>;
    tags?: string[];
  }): Promise<Note> {
    const now = Date.now();
    const newNote: Note = {
      id: data.id ?? generateId(),
      noteTypeId: data.noteTypeId,
      fieldValues: data.fieldValues,
      tags: data.tags ?? [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const validated = noteSchema.parse(newNote);
    await this.db.notes.add(validated);
    return validated;
  }

  async update(id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Note with id ${id} not found`);
    }

    const updated: Note = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const validated = noteSchema.parse(updated);
    await this.db.notes.put(validated);
  }

  async delete(id: string, hard = false): Promise<void> {
    if (hard) {
      await this.db.notes.delete(id);
    } else {
      await this.update(id, { deletedAt: Date.now() });
    }
  }

  /**
   * Searches active notes across fieldValues, tags, and noteTypeId.
   */
  async search(params: {
    query?: string;
    noteTypeId?: string;
    tag?: string;
  }): Promise<Note[]> {
    const query = params.query ? params.query.trim().toLowerCase() : '';
    const noteTypeId = params.noteTypeId;
    const tag = params.tag ? params.tag.trim().toLowerCase() : '';

    return this.db.notes
      .filter((note) => {
        if (note.deletedAt !== null) return false;
        if (noteTypeId && note.noteTypeId !== noteTypeId) return false;
        if (tag && !note.tags.some((t) => t.toLowerCase() === tag)) return false;

        if (query) {
          const matchesField = Object.values(note.fieldValues).some((val) =>
            val.toLowerCase().includes(query)
          );
          const matchesTag = note.tags.some((t) => t.toLowerCase().includes(query));
          return matchesField || matchesTag;
        }

        return true;
      })
      .toArray();
  }

  /**
   * Retrieves all unique tags currently in use across active notes.
   */
  async getAllTags(): Promise<string[]> {
    const notes = await this.getAll(false);
    const tagsSet = new Set<string>();
    for (const note of notes) {
      for (const tag of note.tags) {
        if (tag.trim()) {
          tagsSet.add(tag.trim());
        }
      }
    }
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b));
  }
}
