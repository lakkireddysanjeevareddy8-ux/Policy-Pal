import { z } from 'zod';

export const updateDocumentSchema = z.object({
  is_ready: z.boolean(),
  notes: z.string().max(500).nullable().optional(),
});
