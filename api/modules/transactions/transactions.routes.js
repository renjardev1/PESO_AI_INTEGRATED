import express from 'express';
const router   = express.Router();
import { verifyToken, authorizeOwner, authorizeOwnerBody } from '../../middleware/mobileAuthMiddleware.js';
import { authorizeRoles } from '../../middleware/role.middleware.js';
import { maintenanceGuard } from '../../middleware/maintenance.middleware.js';
import { addTransaction, getUserTransactions, getTransaction, editTransaction,
  removeTransaction, getTransactionsByRange, getCategorySummary, getMonthlySummary, } from './transactions.controller.js';

// POST /api/transactions — userId comes from body, not param
router.post('/transactions',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwnerBody,
  addTransaction);

// All other routes use :userId param
router.get('/transactions/:userId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getUserTransactions);

router.get('/transactions/:userId/range',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getTransactionsByRange);

router.get('/transactions/:userId/summary/category',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getCategorySummary);

router.get('/transactions/:userId/summary/monthly',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getMonthlySummary);

router.get('/transactions/:userId/:transactionId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  getTransaction);

router.put('/transactions/:userId/:transactionId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  editTransaction);

router.delete('/transactions/:userId/:transactionId',
  verifyToken, authorizeRoles('user'), maintenanceGuard, authorizeOwner,
  removeTransaction);

export default router;
