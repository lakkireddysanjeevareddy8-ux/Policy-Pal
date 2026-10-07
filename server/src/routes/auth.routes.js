import { Router } from 'express';
import { register, login, getMe, logout, deleteMe, updatePreferredLanguage } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.middleware.js';
import { registerSchema, loginSchema, updateLanguageSchema } from '../schemas/auth.schema.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', requireAuth, getMe);
router.patch('/me/language', requireAuth, validate(updateLanguageSchema), updatePreferredLanguage);
router.delete('/me', requireAuth, deleteMe);
router.post('/logout', logout);

export default router;
