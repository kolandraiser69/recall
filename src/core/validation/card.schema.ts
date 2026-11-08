import { z } from 'zod';
import { CardState } from '../models/card';

export const fsrsDataSchema = z.object({
  stability: z.number().min(0),
  difficulty: z.number().min(0).max(10),
  elapsed_days: z.number().min(0),
  scheduled_days: z.number().min(0),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  state: z.nativeEnum(CardState),
  last_review: z.number().optional(),
});

export const cardSchema = z.object({
  id: z.string().min(1),
  noteId: z.string().min(1),
  deckId: z.string().min(1),
  templateIndex: z.number().int().min(0),
  state: z.nativeEnum(CardState),
  due: z.number(),
  fsrs: fsrsDataSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

export type CardInput = z.infer<typeof cardSchema>;
