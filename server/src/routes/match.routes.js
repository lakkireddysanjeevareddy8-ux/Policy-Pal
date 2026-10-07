import { Router } from 'express';
import { getMatches, updateMatchStatus, toggleChecklistStep } from '../controllers/match.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateMatchStatusSchema, toggleChecklistSchema } from '../schemas/match.schema.js';

const router = Router();

router.use(requireAuth);
router.get('/', getMatches);
router.patch('/:id', validate(updateMatchStatusSchema), updateMatchStatus);
router.patch('/:id/checklist/:index', validate(toggleChecklistSchema), toggleChecklistStep);

export default router;
