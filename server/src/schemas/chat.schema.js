import { z } from 'zod';
import { SUPPORTED_LANG_CODES } from './constants.js';

export const ChatActionSchema = z.object({
  type: z.enum(['open_scheme', 'open_documents', 'start_assessment', 'open_applications']),
  slug: z.string().optional().nullable(),
  label: z.string().min(1).max(60),
});

export const SendMessageRequestSchema = z.object({
  conversation_id: z.string().uuid().optional().nullable(),
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message cannot exceed 1000 characters'),
  ui_language: z.enum(SUPPORTED_LANG_CODES).default('en'),
  input_mode: z.enum(['text', 'voice']).default('text'),
});

export const UpdateConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  archived: z.boolean().optional(),
});

export const GeminiChatOutputSchema = z.object({
  reply: z.string().min(1),
  language: z.enum(SUPPORTED_LANG_CODES).default('en'),
  followups: z.array(z.string().min(1).max(120)).max(3).default([]),
  actions: z.array(ChatActionSchema).max(3).default([]),
});

export const ChatResponseSchema = z.object({
  conversation_id: z.string().uuid(),
  reply: z.string(),
  language: z.enum(SUPPORTED_LANG_CODES),
  followups: z.array(z.string()),
  actions: z.array(ChatActionSchema),
});
