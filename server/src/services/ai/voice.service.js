import { GoogleGenAI } from '@google/genai';
import { TranscribeOutputSchema } from '../../schemas/voice.schema.js';
import { SUPPORTED_LANG_CODES } from '../../schemas/constants.js';
import { redactSensitiveInfo } from '../../utils/redact.js';

export const TRANSCRIPTION_SYSTEM_INSTRUCTION = `You are a high-accuracy multilingual speech-to-text transcription engine for PolicyPal, an Indian public welfare discovery platform.

YOUR SOLE TASK: Transcribe the spoken audio recording VERBATIM into text, using the language and script actually spoken by the citizen.

CRITICAL INSTRUCTIONS:
1. NATIVE SCRIPT PURITY:
   - Telugu speech MUST be transcribed in Telugu script (తెలుగు లిపి).
   - Hindi speech MUST be transcribed in Devanagari script (देवनागरी).
   - Tamil speech MUST be transcribed in Tamil script (தமிழ் எழுத்துக்கள்).
   - Kannada speech MUST be transcribed in Kannada script (ಕನ್ನಡ ಲಿಪಿ).
   - Malayalam speech MUST be transcribed in Malayalam script (മലയാള ലിപി).
   - Marathi speech MUST be transcribed in Devanagari script (देवनागरी).
   - Gujarati speech MUST be transcribed in Gujarati script (ગુજરાતી લિપિ).
   - Bengali speech MUST be transcribed in Bengali script (বাংলা লিপি).
   - Punjabi speech MUST be transcribed in Gurmukhi script (ਗੁਰਮੁਖੀ ਲਿਪੀ).
   - Odia speech MUST be transcribed in Odia script (ଓଡ଼ିଆ ଲିପି).
   - Assamese speech MUST be transcribed in Assamese script (অসমীয়া লিপি).
   - Urdu speech MUST be transcribed in Urdu Nastaliq/Arabic script (اردو رسم الخط).
   - English speech MUST be transcribed in English (Latin alphabet).
   - Widely accepted scheme acronyms (e.g., PM-KISAN, PMAY, Aadhaar, PAN) may remain in their conventional script.
2. VERBATIM ACCURACY: Do NOT translate, do NOT summarize, do NOT correct grammar, do NOT answer questions, and do NOT add any conversational pleasantries.
3. SILENCE / UNINTELLIGIBLE SPEECH: If there is no clear human speech, only background noise, or silence, return an empty string for transcript ("").
4. JSON RESPONSE: Return strictly a valid JSON object matching the schema with:
   - "transcript": the verbatim transcribed text (or empty string).
   - "language": exactly one of the 13 supported language codes: ${SUPPORTED_LANG_CODES.join(', ')}.`;

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Transcribes audio buffer using Gemini multimodal API.
 * Audio is processed strictly in memory and never persisted.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer - In-memory audio buffer
 * @param {string} params.mimeType - Audio MIME type (e.g. audio/webm, audio/mp4, audio/ogg)
 * @param {string} [params.hintLanguage] - Hint language code (e.g. 'te' or 'te-IN')
 * @returns {Promise<{ transcript: string, language: string, wasRedacted: boolean }>}
 */
export async function transcribeAudio({ buffer, mimeType, hintLanguage = 'en' }) {
  const ai = getAiClient();
  if (!ai) {
    const keyError = new Error('Voice transcription service is temporarily unconfigured.');
    keyError.status = 502;
    keyError.code = 'VOICE_UNAVAILABLE';
    throw keyError;
  }

  // Normalize hint language
  const normalizedHint = (hintLanguage || 'en').toLowerCase().split('-')[0];
  const validHint = SUPPORTED_LANG_CODES.includes(normalizedHint) ? normalizedHint : 'en';

  const base64Data = buffer.toString('base64');
  const modelsToTry = [
    process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    process.env.GEMINI_FALLBACK_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  ];

  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const currentModel = modelsToTry[attempt] || modelsToTry[0];
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'audio/webm',
                  data: base64Data,
                },
              },
              {
                text: `Transcribe this audio clip verbatim. The citizen may be speaking in language hint: "${validHint}". Return JSON with { transcript, language }.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: TRANSCRIPTION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              transcript: { type: 'string' },
              language: {
                type: 'string',
                enum: SUPPORTED_LANG_CODES,
              },
            },
            required: ['transcript', 'language'],
          },
          temperature: 0.1,
        },
      });

      const rawText = response.text || '';
      let parsed;
      try {
        parsed = JSON.parse(rawText.trim());
      } catch (parseErr) {
        throw new Error(`Invalid JSON from transcription engine: ${parseErr.message}`);
      }

      // Validate with Zod
      const validated = TranscribeOutputSchema.parse(parsed);

      // Redact sensitive numbers (Aadhaar, PAN, OTP, Bank Accounts) before returning
      const redactionResult = redactSensitiveInfo(validated.transcript);

      return {
        transcript: redactionResult.text,
        language: validated.language,
        wasRedacted: redactionResult.redacted,
      };
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ [Voice Transcribe] Attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt === 0) {
        // Short pause before retry
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  const voiceError = new Error('Voice transcription service is currently unavailable. Please type your message or try again.');
  voiceError.status = 502;
  voiceError.code = 'VOICE_UNAVAILABLE';
  voiceError.originalError = lastError?.message;
  throw voiceError;
}
