import express from 'express';
const router = express.Router();
import { verifyAdmin, requireAdminRole } from '../../middleware/webAuthMiddleware.js';
import { ROLES } from '../../constants/index.js';
import { listUsersSummary, getUserSummary, getPlatformStats } from './admin.controller.js';
import {
  createAnnouncement, listAnnouncementsAdmin, updateAnnouncement,
} from '../announcements/announcements.controller.js';

// All /api/admin/* routes require a valid web admin session (cookie or Bearer)
// Both 'Main Admin' and 'Staff Admin' can access these routes.
router.use(verifyAdmin, requireAdminRole(ROLES.MAIN_ADMIN, ROLES.STAFF_ADMIN));

router.get('/users',           listUsersSummary);
router.get('/users/:userId',   getUserSummary);
router.get('/stats',           getPlatformStats);
router.post('/announcements',  createAnnouncement);
router.get('/announcements',   listAnnouncementsAdmin);
router.put('/announcements/:id', updateAnnouncement);

export default router;
