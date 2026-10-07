import { z } from 'zod';

export const ProfileExtractionSchema = z.object({
  profile: z.object({
    age: z.number().int().min(0).max(125).nullable(),
    gender: z.string().nullable(),
    state: z.string().nullable(),
    district: z.string().nullable(),
    occupation: z.string().nullable(),
    annual_income: z.number().nullable(),
    social_category: z.string().nullable(),
    land_holding_acres: z.number().nullable(),
    education_level: z.string().nullable(),
    is_student: z.boolean().nullable(),
    is_farmer: z.boolean().nullable(),
    is_business_owner: z.boolean().nullable(),
    family_size: z.number().int().nullable(),
  }),
  summary: z.string().min(10),
  missing_info: z.array(z.string()).default([]),
});

export const SchemeMatchItemSchema = z.object({
  scheme_id: z.string().uuid(),
  match_score: z.number().int().min(0).max(100),
  eligibility_reason: z.string().min(10),
  caution: z.string().optional().nullable(),
});

export const SchemeMatchOutputSchema = z.array(SchemeMatchItemSchema);

export const ChecklistItemSchema = z.object({
  step: z.string().min(3),
  detail: z.string().min(5),
});

export const ChecklistOutputSchema = z.array(ChecklistItemSchema).min(3).max(10);

export const createAssessmentSchema = z.object({
  situation_text: z
    .string()
    .trim()
    .min(10, 'Please describe your situation in at least 10 characters')
    .max(2000, 'Situation description cannot exceed 2000 characters'),
  language: z.enum(['en', 'te', 'hi']).default('en'),
});

export const updateAssessmentSchema = z.object({
  situation_text: z.string().trim().min(10).max(2000).optional(),
  archived: z.boolean().optional(),
});
