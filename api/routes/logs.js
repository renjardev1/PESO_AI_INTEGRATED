import express from 'express';
import { verifyAdmin } from '../middleware/webAuthMiddleware.js';
import { createLog, getLogs, deleteLogs } from '../controllers/logController.js';
import { validateCreateLog } from '../validators/logValidator.js';

const router = express.Router();
router.post('/logs',   verifyAdmin, validateCreateLog, createLog);
router.get('/logs',    verifyAdmin, getLogs);
router.delete('/logs', verifyAdmin, deleteLogs);

export default router;
