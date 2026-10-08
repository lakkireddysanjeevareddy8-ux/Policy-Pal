import { z } from 'zod';
import { SUPPORTED_LANG_CODES } from './constants.js';

export const TranscribeOutputSchema = z.object({
  transcript: z.string().describe('Verbatim transcription in the exact spoken language and script'),
  language: z.enum(SUPPORTED_LANG_CODES).describe('Detected language code among the 13 supported languages'),
});

export const TranscribeRequestSchema = z.object({
  hint_language: z.string().optional(),
  audio_base64: z.string().optional(),
  mime_type: z.string().optional(),
});
