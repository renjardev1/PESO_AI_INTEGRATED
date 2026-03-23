import express from 'express';
const router   = express.Router();
import { verifyToken, authorizeOwner } from '../../middleware/mobileAuthMiddleware.js';
import { signup, login, completeOnboarding,
  forgotPassword, resetPassword, getUserProfileData, } from './auth.controller.js';

// ── Public (no token required) ────────────────────────────────────────────────
router.post('/signup',          signup);
router.post('/login',           login);
router.post('/onboarding',      completeOnboarding);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

// ── Light profile check (token required, used after login to re-verify onboarding) ──
router.get('/profile/:userId',  verifyToken, authorizeOwner, getUserProfileData);

export default router;
