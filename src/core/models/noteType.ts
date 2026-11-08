export interface FieldDefinition {
  id: string;
  name: string;
  description?: string;
}

export interface CardTemplate {
  name: string;
  qfmt: string;             // Question HTML format (e.g., "{{Front}}")
  afmt: string;             // Answer HTML format (e.g., "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}")
}

export interface NoteType {
  id: string;
  name: string;             // e.g. "Basic", "Basic (and reversed card)", "Cloze"
  isCloze: boolean;
  fields: FieldDefinition[];
  templates: CardTemplate[];
  css: string;              // Custom styling scoped to card preview
  updatedAt: number;
  deletedAt: number | null;
}
