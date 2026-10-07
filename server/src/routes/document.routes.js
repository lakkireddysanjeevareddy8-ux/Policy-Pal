import { Router } from 'express';
import { getDocuments, updateDocument } from '../controllers/document.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateDocumentSchema } from '../schemas/document.schema.js';

const router = Router();

router.use(requireAuth);
router.get('/', getDocuments);
router.put('/:key', validate(updateDocumentSchema), updateDocument);

export default router;
