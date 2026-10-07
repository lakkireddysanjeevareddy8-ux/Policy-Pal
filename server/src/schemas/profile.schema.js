import { z } from 'zod';

export const updateProfileSchema = z.object({
  age: z.number().int().min(0).max(125).nullable().optional(),
  gender: z.string().trim().max(50).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  district: z.string().trim().max(100).nullable().optional(),
  occupation: z.string().trim().max(150).nullable().optional(),
  annual_income: z.number().min(0).nullable().optional(),
  social_category: z.string().trim().max(50).nullable().optional(),
  land_holding_acres: z.number().min(0).nullable().optional(),
  education_level: z.string().trim().max(100).nullable().optional(),
  is_student: z.boolean().nullable().optional(),
  is_farmer: z.boolean().nullable().optional(),
  is_business_owner: z.boolean().nullable().optional(),
  family_size: z.number().int().min(1).max(50).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
