import { z } from 'zod';
import { CardState, Rating } from '../models/card';

export const reviewLogSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  rating: z.nativeEnum(Rating),
  state: z.nativeEnum(CardState),
  due: z.number(),
  stability: z.number().min(0),
  difficulty: z.number().min(0).max(10),
  elapsedDays: z.number().min(0),
  lastElapsedDays: z.number().min(0),
  scheduledDays: z.number().min(0),
  reviewTime: z.number(),
  durationMs: z.number().min(0),
  deletedAt: z.number().nullable(),
});

export type ReviewLogInput = z.infer<typeof reviewLogSchema>;
