import express from 'express';
const router   = express.Router();
import { verifyToken, authorizeOwner, authorizeOwnerBody } from '../../middleware/mobileAuthMiddleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { maintenanceGuard } from '../../middleware/maintenance.middleware.js';

import { getProfile, updateProfile, uploadProfilePicture,
  updateBudget, updateBudgetPeriod, changePassword, deleteAccount, } from './profile.controller.js';

import { getDashboard, getFullProfile } from './dashboard.controller.js';

import { getNotifications, updateNotificationSettings,
  markRead, markAllRead, triggerDailyReminder, } from './notification.controller.js';

import { createBackup, listBackups, restoreBackup, deleteBackup } from './backup.controller.js';
import { getAppLock, setAppLock, verifyPin } from './app_lock.controller.js';
import { exportTransactionsPDF } from './export.controller.js';
import { getCategories, addCategory, updateCategory, deleteCategory } from './category.controller.js';

import { chatWithAI, clearConversation, getChatHistory, checkHealth,
  generateInsights, saveConversationHistory, getConversationHistory,
  getConversationById, deleteConversationHistory, } from './ai.controller.js';

import { getRecurring, createRecurring, updateRecurring, cancelRecurring,
  deleteRecurring, markRecurringAsPaid, dismissRecurring, } from './recurring.controller.js';

import { getUserAnnouncements } from '../announcements/announcements.controller.js';

// ── Middleware stack applied per-route to match original behaviour ─────────────
// verifyToken  — validates JWT, sets req.user = { id, role }
// authorizeRoles('user') — blocks admin/superadmin from user-only routes
// maintenanceGuard — returns 503 when maintenance is active (bypassed for admin+SA)
// authorizeOwner — confirms token owner == :userId param

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getDashboard);

router.get('/dashboard/:userId/profile',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getFullProfile);

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getProfile);

router.put('/profile/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  updateProfile);

router.put('/profile/:userId/picture',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  uploadProfilePicture);

router.put('/profile/:userId/budget',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  updateBudget);

router.put('/profile/:userId/budget-period',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  updateBudgetPeriod);

router.put('/profile/:userId/password',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  changePassword);

router.delete('/profile/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  deleteAccount);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getNotifications);

router.put('/notifications/:userId/settings',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  updateNotificationSettings);

// read-all must come before /:notificationId/read to avoid Express swallowing it
router.put('/notifications/:userId/read-all',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  markAllRead);

router.put('/notifications/:userId/:notificationId/read',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  markRead);

router.post('/notifications/daily/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  triggerDailyReminder);

// ── Announcements (read-only, active only) ────────────────────────────────────
router.get('/announcements',
  verifyToken, authorizeRoles('user'), maintenanceGuard,
  getUserAnnouncements);

// ── Recurring Transactions ────────────────────────────────────────────────────
router.get('/recurring/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getRecurring);

router.post('/recurring/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  createRecurring);

router.put('/recurring/:userId/:recurringId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  updateRecurring);

router.put('/recurring/:userId/:recurringId/cancel',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  cancelRecurring);

router.delete('/recurring/:userId/:recurringId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  deleteRecurring);

router.post('/recurring/:userId/:recurringId/pay',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  markRecurringAsPaid);

router.post('/recurring/:userId/:recurringId/dismiss',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  dismissRecurring);

// ── Export ────────────────────────────────────────────────────────────────────
router.post('/export/transactions/:userId/pdf',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  exportTransactionsPDF);

// ── Backup & Restore ──────────────────────────────────────────────────────────
router.post('/backup/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  createBackup);

router.get('/backup/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  listBackups);

router.post('/backup/:userId/restore/:backupId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  restoreBackup);

router.delete('/backup/:userId/:backupId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  deleteBackup);

// ── App Lock ──────────────────────────────────────────────────────────────────
router.get('/app-lock/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getAppLock);

router.put('/app-lock/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  setAppLock);

router.post('/app-lock/:userId/verify',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  verifyPin);

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/categories/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getCategories);

router.post('/categories/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  addCategory);

router.put('/categories/:userId/:categoryId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  updateCategory);

router.delete('/categories/:userId/:categoryId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  deleteCategory);

// ── AI ────────────────────────────────────────────────────────────────────────
// health is public — no auth required
router.get('/ai/health', checkHealth);

router.post('/ai/chat/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  chatWithAI);

router.delete('/ai/conversation/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  clearConversation);

router.get('/ai/history/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getChatHistory);

router.get('/ai/insights/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  generateInsights);

router.post('/ai/history/save/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  saveConversationHistory);

// list must come before get/:historyId to avoid shadowing
router.get('/ai/history/list/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getConversationHistory);

router.get('/ai/history/get/:userId/:historyId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getConversationById);

router.delete('/ai/history/:userId/:historyId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  deleteConversationHistory);

export default router;
