import { z } from 'zod';

export const appSettingsSchema = z.object({
  // Study & FSRS
  desiredRetention: z.number().min(0.8).max(0.97).default(0.9),
  newCardsPerDay: z.number().int().min(0).max(500).default(20),
  maxReviewsPerDay: z.number().int().min(0).max(2000).default(200),
  learningSteps: z.array(z.number().positive()).min(1).default([1, 10]),
  relearningSteps: z.array(z.number().positive()).min(1).default([10]),
  dayCutoffHour: z.number().int().min(0).max(23).default(4),
  autoRevealAnswer: z.boolean().default(false),
  showTimer: z.boolean().default(true),

  // General & Accessibility
  language: z.enum(['en', 'de']).default('en'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  compactDensity: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  confirmDestructive: z.boolean().default(true),
});

export type ValidatedAppSettings = z.infer<typeof appSettingsSchema>;
