import express from 'express';
const router   = express.Router();
import { verifyToken, authorizeOwner } from '../../middleware/mobileAuthMiddleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { maintenanceGuard } from '../../middleware/maintenance.middleware.js';
import { getAnalytics, getSpendingTrendData, getTrendData,
  getPlatformSummary, getDetailedAnalytics, } from './analytics.controller.js';

// ── User own analytics — preserve original exact paths /api/analytics/* ───────
// trend-chart and trend must come before /:userId to avoid Express shadowing
router.get('/analytics/trend-chart/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getTrendData);

router.get('/analytics/trend/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getSpendingTrendData);

router.get('/analytics/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getAnalytics);

// ── Platform-wide analytics — new endpoints, admin + superadmin only ──────────
router.get('/analytics/summary',
  verifyToken, authorizeRoles('admin', 'superadmin'),
  getPlatformSummary);

router.get('/analytics/detailed',
  verifyToken, authorizeRoles('superadmin'),
  getDetailedAnalytics);

export default router;
