import { z } from 'zod';

export const mediaItemSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  data: z.custom<Blob>(
    (val) => val instanceof Blob || (typeof val === 'object' && val !== null && 'size' in val),
    { message: 'Expected a binary Blob' }
  ),
  hash: z.string().min(1),
  size: z.number().int().min(0),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
});

export type MediaItemInput = z.infer<typeof mediaItemSchema>;
