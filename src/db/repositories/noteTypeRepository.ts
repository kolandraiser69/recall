import type { RecallDatabase } from '../database';
import type { NoteType, FieldDefinition, CardTemplate } from '../../core/models/noteType';
import { noteTypeSchema } from '../../core/validation/noteType.schema';
import { generateId } from '../../utils/id';

export class NoteTypeRepository {
  constructor(private db: RecallDatabase) {}

  async getById(id: string): Promise<NoteType | undefined> {
    return this.db.noteTypes.get(id);
  }

  async getAll(includeDeleted = false): Promise<NoteType[]> {
    if (includeDeleted) {
      return this.db.noteTypes.toArray();
    }
    return this.db.noteTypes.filter((nt) => nt.deletedAt === null).toArray();
  }

  async create(data: {
    id?: string;
    name: string;
    isCloze?: boolean;
    fields: FieldDefinition[];
    templates: CardTemplate[];
    css?: string;
  }): Promise<NoteType> {
    const newNoteType: NoteType = {
      id: data.id ?? generateId(),
      name: data.name,
      isCloze: data.isCloze ?? false,
      fields: data.fields,
      templates: data.templates,
      css: data.css ?? '',
      updatedAt: Date.now(),
      deletedAt: null,
    };

    const validated = noteTypeSchema.parse(newNoteType);
    await this.db.noteTypes.add(validated);
    return validated;
  }

  async update(id: string, updates: Partial<Omit<NoteType, 'id'>>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`NoteType with id ${id} not found`);
    }

    const updated: NoteType = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const validated = noteTypeSchema.parse(updated);
    await this.db.noteTypes.put(validated);
  }

  async delete(id: string, hard = false): Promise<void> {
    if (hard) {
      await this.db.noteTypes.delete(id);
    } else {
      await this.update(id, { deletedAt: Date.now() });
    }
  }
}
