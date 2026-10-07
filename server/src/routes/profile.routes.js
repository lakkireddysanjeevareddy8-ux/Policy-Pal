import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateProfileSchema } from '../schemas/profile.schema.js';

const router = Router();

router.use(requireAuth);
router.get('/', getProfile);
router.put('/', validate(updateProfileSchema), updateProfile);

export default router;
