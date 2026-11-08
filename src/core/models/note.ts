export interface Note {
  id: string;
  noteTypeId: string;
  fieldValues: Record<string, string>; // Maps Field Name -> HTML/Text content
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
