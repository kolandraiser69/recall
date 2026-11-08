import { z } from 'zod';

export const fieldDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const cardTemplateSchema = z.object({
  name: z.string().min(1),
  qfmt: z.string(),
  afmt: z.string(),
});

export const noteTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isCloze: z.boolean(),
  fields: z.array(fieldDefinitionSchema),
  templates: z.array(cardTemplateSchema),
  css: z.string(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

export type NoteTypeInput = z.infer<typeof noteTypeSchema>;
