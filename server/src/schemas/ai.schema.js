import { z } from 'zod';

export const ProfileExtractionSchema = z.object({
  profile: z.object({
    age: z.number().int().min(0).max(125).nullable().describe('Age in years'),
    gender: z.string().nullable().describe('Canonical English: "male", "female", or "other"'),
    state: z.string().nullable().describe('Canonical English name of Indian State or UT, e.g. "Telangana"'),
    district: z.string().nullable().describe('Canonical English name of district, e.g. "Warangal"'),
    occupation: z.string().nullable().describe('Canonical English occupation, e.g. "farmer"'),
    annual_income: z.number().nullable().describe('Annual income in Indian Rupees (INR)'),
    social_category: z.string().nullable().describe('Canonical English category: "General", "OBC", "SC", "ST", "EWS"'),
    land_holding_acres: z.number().nullable(),
    education_level: z.string().nullable().describe('Canonical English education level'),
    is_student: z.boolean().nullable(),
    is_farmer: z.boolean().nullable(),
    is_business_owner: z.boolean().nullable(),
    family_size: z.number().int().nullable(),
  }),
  summary: z.string().min(10).describe('Empathetic summary written in the user requested language'),
  missing_info: z.array(z.string()).default([]),
});

export const SchemeMatchItemSchema = z.object({
  scheme_id: z.string().uuid(),
  match_score: z.number().int().min(0).max(100),
  eligibility_reason: z.string().min(10),
  caution: z.string().optional().nullable(),
  assumptions_to_confirm: z.array(z.string()).default([]),
});

export const SchemeMatchOutputSchema = z.array(SchemeMatchItemSchema);

export const ChecklistItemSchema = z.object({
  step: z.string().min(3),
  detail: z.string().min(5),
});

export const ChecklistOutputSchema = z.array(ChecklistItemSchema).min(3).max(10);

import { SUPPORTED_LANG_CODES } from './constants.js';

export const createAssessmentSchema = z.object({
  situation_text: z
    .string()
    .trim()
    .min(10, 'Please describe your situation in at least 10 characters')
    .max(2000, 'Situation description cannot exceed 2000 characters'),
  language: z.enum(SUPPORTED_LANG_CODES).default('en'),
});

export const updateAssessmentSchema = z.object({
  situation_text: z.string().trim().min(10).max(2000).optional(),
  archived: z.boolean().optional(),
});
