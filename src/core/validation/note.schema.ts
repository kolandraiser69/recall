import { z } from 'zod';

export const noteSchema = z.object({
  id: z.string().min(1),
  noteTypeId: z.string().min(1),
  fieldValues: z.record(z.string(), z.string()),
  tags: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

export type NoteInput = z.infer<typeof noteSchema>;
