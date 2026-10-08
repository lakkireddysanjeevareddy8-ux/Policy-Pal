import { transcribeAudio } from '../services/ai/voice.service.js';

const MAX_AUDIO_BYTES = 1.5 * 1024 * 1024; // 1.5 MB limit

const ALLOWED_MIME_PREFIXES = [
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'video/webm', // MediaRecorder in some browsers produces video/webm for audio-only streams
  'video/mp4',
];

function isSupportedMime(mimeType) {
  if (!mimeType) return false;
  const lower = mimeType.toLowerCase();
  return ALLOWED_MIME_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Handles voice transcription POST /api/voice/transcribe
 * Audio processed strictly in memory and never persisted.
 */
export async function handleTranscribe(req, res, next) {
  try {
    let audioBuffer = null;
    let mimeType = null;
    let hintLanguage = req.body?.hint_language || req.query?.hint_language || 'en';

    // 1. Check if multipart file upload
    if (req.file) {
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    } else if (req.body?.audio_base64) {
      // 2. Check if base64 encoded audio in JSON body
      mimeType = req.body.mime_type || 'audio/webm';
      let rawBase64 = req.body.audio_base64;
      // Strip data URI prefix if present (e.g., data:audio/webm;base64,...)
      if (rawBase64.includes(';base64,')) {
        const parts = rawBase64.split(';base64,');
        mimeType = parts[0].replace('data:', '') || mimeType;
        rawBase64 = parts[1];
      }
      audioBuffer = Buffer.from(rawBase64, 'base64');
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_AUDIO',
          message: 'No audio provided. Please submit an audio file or base64 audio payload.',
        },
      });
    }

    // Check size limit: max 1.5 MB
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Audio file exceeds maximum size limit of 1.5 MB (${(audioBuffer.length / (1024 * 1024)).toFixed(2)} MB received).`,
        },
      });
    }

    // Check MIME type
    if (!isSupportedMime(mimeType)) {
      return res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Audio format "${mimeType || 'unknown'}" is not supported. Supported formats: webm, mp4, ogg, wav, m4a.`,
        },
      });
    }

    // Perform verbatim transcription via Gemini
    const result = await transcribeAudio({
      buffer: audioBuffer,
      mimeType,
      hintLanguage,
    });

    return res.status(200).json({
      success: true,
      transcript: result.transcript,
      language: result.language,
      wasRedacted: result.wasRedacted,
    });
  } catch (err) {
    if (err.code === 'VOICE_UNAVAILABLE' || err.status === 502) {
      return res.status(502).json({
        success: false,
        error: {
          code: 'VOICE_UNAVAILABLE',
          message: 'Voice transcription service is currently unavailable. Please type your message or try again.',
        },
      });
    }
    next(err);
  }
}
