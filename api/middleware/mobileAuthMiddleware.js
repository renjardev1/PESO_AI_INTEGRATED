import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { MESSAGES } from '../shared/constants/messages.js';

/**
 * verifyToken
 * -----------
 * Validates the JWT in the Authorization header.
 * Attaches decoded payload { id, role } to req.user.
 * Also fire-and-forgets a last_active_at update so the web admin
 * always sees an accurate "Last Online" timestamp.
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: MESSAGES.UNAUTHORIZED });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }

    // Fire-and-forget — never blocks the request
    pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [decoded.id])
      .catch(() => {}); // silently swallow errors

    next();
  } catch {
    return res.status(401).json({ success: false, message: MESSAGES.UNAUTHORIZED });
  }
};

/**
 * authorizeOwner
 * --------------
 * For user-scoped routes with :userId param.
 * Ensures the token owner is the same as the target user.
 * SuperAdmins may bypass — they can read any user's data (logged separately).
 */
const authorizeOwner = (req, res, next) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId.' });
  if (req.user.role === 'superadmin') return next(); // superadmin bypass
  if (req.user.id !== userId) {
    return res.status(403).json({ success: false, message: MESSAGES.FORBIDDEN });
  }
  next();
};

/**
 * authorizeOwnerBody
 * ------------------
 * Same as authorizeOwner but reads userId from req.body (POST/PUT without param).
 */
const authorizeOwnerBody = (req, res, next) => {
  const userId = req.body?.userId;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId.' });
  if (req.user.role === 'superadmin') return next();
  if (req.user.id !== userId) {
    return res.status(403).json({ success: false, message: MESSAGES.FORBIDDEN });
  }
  next();
};

export { verifyToken, authorizeOwner, authorizeOwnerBody };