import { z } from 'zod';

export const updateMatchStatusSchema = z.object({
  status: z.enum(['saved', 'applying', 'applied', 'rejected', 'archived']),
});

export const toggleChecklistSchema = z.object({
  done: z.boolean().optional(),
});
