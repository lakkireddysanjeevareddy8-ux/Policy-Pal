import { Router } from 'express';
import { getSchemes, getSchemeBySlug } from '../controllers/scheme.controller.js';

const router = Router();

router.get('/', getSchemes);
router.get('/:slug', getSchemeBySlug);

export default router;
