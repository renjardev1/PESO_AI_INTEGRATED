import express from 'express';
import { randomUUID } from 'crypto';
import { verifyAdmin } from '../middleware/webAuthMiddleware.js';
import {
  login, logout, verify, refresh,
  updateAvatar, updateDisplayName, getMe,
  createAdmin, getAdmins, deleteAdmin,
  changePassword, getAuditLogs, createAuditLog,
} from '../controllers/authController.js';
import {
  validateLogin, validateChangePassword, validateAvatar,
  validateDisplayName, validateCreateAdmin, validateAuditLog, validateDeleteAdmin,
} from '../validators/authValidator.js';

const router = express.Router();

router.get('/csrf-token', (_req, res) => {
  const token = randomUUID();
  res.cookie('csrf_token', token, { httpOnly:false, secure:false, sameSite:'lax', path:'/', maxAge:3600000 });
  return res.json({ csrfToken: token });
});

router.post('/login',                 validateLogin,                     login);
router.post('/refresh',                                                   refresh);
router.post('/logout',                                                   logout);
router.get('/verify',                 verifyAdmin,                       verify);
router.put('/admins/avatar',          verifyAdmin, validateAvatar,       updateAvatar);
router.put('/admins/display-name',    verifyAdmin, validateDisplayName,  updateDisplayName);
router.put('/admins/change-password', verifyAdmin, validateChangePassword, changePassword);
router.get('/admins/me',              verifyAdmin,                       getMe);
router.post('/admins',                verifyAdmin, validateCreateAdmin,  createAdmin);
router.get('/admins',                 verifyAdmin,                       getAdmins);
router.delete('/admins/:id',          verifyAdmin, validateDeleteAdmin,  deleteAdmin);
router.get('/audit-logs',             verifyAdmin,                       getAuditLogs);
router.post('/audit-logs',            verifyAdmin, validateAuditLog,     createAuditLog);

export default router;
