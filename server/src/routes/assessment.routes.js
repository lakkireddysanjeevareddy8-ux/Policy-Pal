import { Router } from 'express';
import {
  createAssessment,
  getAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  rerunAssessment,
} from '../controllers/assessment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { aiLimiter } from '../middleware/rateLimiter.middleware.js';
import {
  createAssessmentSchema,
  updateAssessmentSchema,
} from '../schemas/ai.schema.js';

const router = Router();

router.use(requireAuth);

router.post('/', aiLimiter, validate(createAssessmentSchema), createAssessment);
router.get('/', getAssessments);
router.get('/:id', getAssessmentById);
router.patch('/:id', validate(updateAssessmentSchema), updateAssessment);
router.delete('/:id', deleteAssessment);
router.post('/:id/rerun', aiLimiter, rerunAssessment);

export default router;
