import { z } from 'zod';

export const quicklinkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  url: z.string().url(),
  domain: z.string().min(1),
  isFavorite: z.boolean(),
  order: z.number().int().min(0),
  category: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});
