import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware.js';
import { handleTranscribe } from '../controllers/voice.controller.js';

const router = Router();

// Memory-only storage with 1.5 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1.5 * 1024 * 1024, // 1.5 MB
    files: 1,
  },
});

// Rate limit: 20 transcription requests per 10 minutes per user/IP
const voiceRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many voice transcription requests. Please try again after 10 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Route: POST /api/voice/transcribe
router.post(
  '/transcribe',
  voiceRateLimiter,
  requireAuth,
  upload.single('audio'),
  handleTranscribe
);

export default router;
