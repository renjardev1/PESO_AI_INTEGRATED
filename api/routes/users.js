import express from 'express';
import {
  getUsers, getUserById, updateUser, pingActive,
  getUserAvatar, updateUserAvatar,
  getKpis, getTopCategories, getHighRisk,
  getMonthlyTrend, getSavingsDistribution,
} from '../controllers/userController.js';
import { verifyAdmin } from '../middleware/webAuthMiddleware.js';
import {
  validateUserIdParam, validateUpdateUser, validateUpdateUserAvatar,
  validateRiskLevelQuery, validatePeriodQuery,
} from '../validators/userValidator.js';

const router = express.Router();
router.get('/users',                      verifyAdmin, getUsers);
router.get('/users/:id',                  verifyAdmin, validateUserIdParam, getUserById);
router.get('/users/:id/avatar',           verifyAdmin, validateUserIdParam, getUserAvatar);
router.patch('/users/:id',                verifyAdmin, validateUpdateUser,  updateUser);
router.put('/users/:id/avatar',           verifyAdmin, validateUpdateUserAvatar, updateUserAvatar);
router.post('/users/:id/active',          verifyAdmin, validateUserIdParam, pingActive);
router.get('/admin/kpis',                 verifyAdmin, getKpis);
router.get('/admin/top-categories',       verifyAdmin, getTopCategories);
router.get('/admin/high-risk',            verifyAdmin, validateRiskLevelQuery, getHighRisk);
router.get('/admin/monthly-trend',        verifyAdmin, validatePeriodQuery, getMonthlyTrend);
router.get('/admin/savings-distribution', verifyAdmin, validatePeriodQuery, getSavingsDistribution);

export default router;
