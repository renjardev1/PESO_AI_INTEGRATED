import express from 'express';
const router = express.Router();
import { verifyAdmin, requireAdminRole } from '../../middleware/webAuthMiddleware.js';
import { ROLES } from '../../constants/index.js';
import { logAccess } from '../../middleware/accessLog.middleware.js';
import {
  listUsersDetailed, getUserTransactions,
  disableUser, enableUser,
  getMaintenanceStatus, setMaintenanceStatus,
  listAdmins, createAdmin, deleteAdmin,
  getAccessLogs,
} from './superadmin.controller.js';
import { deleteAnnouncement } from '../announcements/announcements.controller.js';

// All /api/superadmin/* routes require Main Admin role only
router.use(verifyAdmin, requireAdminRole(ROLES.MAIN_ADMIN));

router.get('/users',                          listUsersDetailed);
router.get('/users/:userId/transactions',     logAccess, getUserTransactions);
router.put('/users/:userId/disable',          disableUser);
router.put('/users/:userId/enable',           enableUser);
router.get('/maintenance',                    getMaintenanceStatus);
router.post('/maintenance',                   setMaintenanceStatus);
router.get('/admins',                         listAdmins);
router.post('/admins',                        createAdmin);
router.delete('/admins/:adminId',             deleteAdmin);
router.get('/access-logs',                    getAccessLogs);
router.delete('/announcements/:id',           deleteAnnouncement);

export default router;
