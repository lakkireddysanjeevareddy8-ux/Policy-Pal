import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  sendMessage,
  getConversations,
  getConversationById,
  updateConversation,
  deleteConversation,
} from '../controllers/chat.controller.js';

const router = Router();

// Rate limit: 30 chat requests per 10 minutes per user/IP
const chatRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many chat messages sent. Please slow down and try again after a few minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All chat routes require authentication
router.use(requireAuth);

router.post('/', chatRateLimiter, sendMessage);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversationById);
router.patch('/conversations/:id', updateConversation);
router.delete('/conversations/:id', deleteConversation);

export default router;
