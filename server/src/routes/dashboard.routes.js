import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', getDashboard);

export default router;
