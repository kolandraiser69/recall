import { z } from 'zod';

export const deckSettingsSchema = z.object({
  newCardsPerDay: z.number().int().min(0),
  maxReviewsPerDay: z.number().int().min(0),
  desiredRetention: z.number().min(0.7).max(0.99),
  learningSteps: z.array(z.number().min(0.1)),
  relearningSteps: z.array(z.number().min(0.1)),
  fsrsParameters: z.array(z.number()).optional(),
});

export const deckSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  parentId: z.string().nullable(),
  description: z.string(),
  settings: deckSettingsSchema,
  order: z.number().int(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

export type DeckInput = z.infer<typeof deckSchema>;
export type DeckSettingsInput = z.infer<typeof deckSettingsSchema>;
