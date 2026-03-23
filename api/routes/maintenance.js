import express from 'express';
import { verifyAdmin } from '../middleware/webAuthMiddleware.js';
import { getMaintenance, setMaintenance } from '../controllers/maintenanceController.js';
import { validateSetMaintenance } from '../validators/maintenanceValidator.js';

const router = express.Router();
router.get('/maintenance',  verifyAdmin, getMaintenance);
router.post('/maintenance', verifyAdmin, validateSetMaintenance, setMaintenance);

export default router;
