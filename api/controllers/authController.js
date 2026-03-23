import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { HTTP, ROLES, BCRYPT_ROUNDS, AUDIT_LIMIT } from '../constants/index.js';
import { REFRESH_COOKIE_NAME } from '../config/index.js';
import { setAccessCookie, setRefreshCookie, clearAuthCookies } from '../utils/cookieAuth.js';
import {
  signAccessToken, signRefreshToken, persistRefreshToken,
  revokeAllRefreshTokensForAdmin, revokeRefreshToken,
  verifyRefreshToken, rotateRefreshToken,
} from '../utils/tokenService.js';
import { toSafeUser } from '../utils/responseSanitizer.js';
import { sendError } from '../utils/apiResponse.js';

export async function safeLog(type, userName, message) {
  try {
    await pool.query(
      'INSERT INTO system_logs (type, timestamp, user_name, message) VALUES ($1, NOW(), $2, $3)',
      [type, userName, message]);
  } catch {}
}

export async function safeAudit(adminId, action, targetType = 'admin') {
  try {
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action, target_type) VALUES ($1, $2, $3)',
      [adminId, action, targetType]);
  } catch (err) { console.warn('[AUDIT WARN]', err.message); }
}

const getAdminForSession = async (adminId) => {
  const result = await pool.query(
    'SELECT admin_id, username, display_name, role, avatar FROM admins WHERE admin_id = $1',
    [adminId]);
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { id: row.admin_id, username: row.username, display_name: row.display_name, role: row.role, avatar: row.avatar || null };
};

export const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT admin_id, username, password, role, display_name, avatar FROM admins WHERE username = $1',
      [username]);
    if (result.rows.length === 0) {
      await safeLog('FAILED', username, 'Failed login attempt: user not found');
      return sendError(res, HTTP.UNAUTHORIZED, 'Invalid credentials');
    }
    const admin = result.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      await safeLog('FAILED', username, 'Failed login attempt: wrong password');
      return sendError(res, HTTP.UNAUTHORIZED, 'Invalid credentials');
    }
    const sessionAdmin = { id: admin.admin_id, name: admin.username, role: admin.role, display_name: admin.display_name, avatar: admin.avatar || null };
    const accessToken  = signAccessToken(sessionAdmin);
    const refreshToken = signRefreshToken(sessionAdmin);
    await persistRefreshToken(sessionAdmin.id, refreshToken);
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);
    await safeLog('SUCCESS', admin.username, `Authorized access as ${admin.role}`);
    await safeAudit(admin.admin_id, `Login: ${admin.username}`);
    return res.json(toSafeUser({ id: sessionAdmin.id, display_name: sessionAdmin.display_name, username: sessionAdmin.name, role: sessionAdmin.role, avatar: sessionAdmin.avatar }));
  } catch (err) {
    console.error('[LOGIN ERROR]', err.message);
    return res.status(HTTP.INTERNAL).json({ message: 'Server error' });
  }
};

export const refresh = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) { clearAuthCookies(res); return res.status(HTTP.UNAUTHORIZED).json({ message: 'Missing refresh token' }); }
  try {
    const payload = verifyRefreshToken(refreshToken);
    const admin   = await getAdminForSession(payload.sub);
    if (!admin) { clearAuthCookies(res); return res.status(HTTP.UNAUTHORIZED).json({ message: 'Invalid session' }); }
    const rotated = await rotateRefreshToken(refreshToken, { id: admin.id, name: admin.username, role: admin.role });
    if (!rotated) { clearAuthCookies(res); return res.status(HTTP.UNAUTHORIZED).json({ message: 'Refresh token expired' }); }
    setAccessCookie(res, rotated.accessToken);
    setRefreshCookie(res, rotated.refreshToken);
    return res.json(toSafeUser(admin));
  } catch { clearAuthCookies(res); return res.status(HTTP.UNAUTHORIZED).json({ message: 'Invalid refresh token' }); }
};

export const logout = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken) await revokeRefreshToken(refreshToken);
  if (req.admin?.id) {
    await revokeAllRefreshTokensForAdmin(req.admin.id);
    await safeLog('SYSTEM', req.admin.name, `${req.admin.name} logged out`);
    await safeAudit(req.admin.id, `Logout: ${req.admin.name}`);
  }
  clearAuthCookies(res);
  return res.json({ success: true });
};

export const verify = async (req, res) => {
  const admin = await getAdminForSession(req.admin.id);
  if (!admin) { clearAuthCookies(res); return res.status(HTTP.UNAUTHORIZED).json({ message: 'Session not found' }); }
  return res.json(toSafeUser(admin));
};

export const updateAvatar = async (req, res) => {
  const { avatar } = req.body;
  try {
    await pool.query('UPDATE admins SET avatar = $1 WHERE admin_id = $2', [avatar, req.admin.id]);
    await safeAudit(req.admin.id, 'Updated profile avatar');
    return res.json({ message: 'Avatar saved successfully', avatar });
  } catch (err) { return res.status(HTTP.INTERNAL).json({ error: 'Unable to save avatar' }); }
};

export const updateDisplayName = async (req, res) => {
  const { displayName } = req.body;
  try {
    await pool.query('UPDATE admins SET display_name = $1 WHERE admin_id = $2', [displayName, req.admin.id]);
    await safeAudit(req.admin.id, `Updated display name to "${displayName}"`);
    return res.json({ message: 'Display name updated', displayName });
  } catch (err) { return res.status(HTTP.INTERNAL).json({ error: 'Unable to update display name' }); }
};

export const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT admin_id, username, role, display_name, avatar FROM admins WHERE admin_id = $1',
      [req.admin.id]);
    if (result.rows.length === 0) return res.status(HTTP.NOT_FOUND).json({ message: 'Admin not found' });
    return res.json(toSafeUser(result.rows[0]));
  } catch (err) { return res.status(HTTP.INTERNAL).json({ error: 'Unable to fetch profile' }); }
};

export const createAdmin = async (req, res) => {
  const { username, password, role } = req.body;
  if (req.admin.role !== ROLES.MAIN_ADMIN)
    return res.status(HTTP.FORBIDDEN).json({ message: 'Forbidden: Only Main Admin can create accounts' });
  try {
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO admins (username, password, role) VALUES ($1, $2, $3) RETURNING admin_id, username, role, created_at',
      [username, hashed, role]);
    await safeAudit(req.admin.id, `Created admin: ${username} (${role})`);
    return res.json({ message: 'Account created successfully', admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(HTTP.CONFLICT).json({ message: 'Username already exists' });
    return res.status(HTTP.INTERNAL).json({ error: 'Unable to create account' });
  }
};

export const getAdmins = async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT admin_id, username, display_name, role, avatar, created_at FROM admins ORDER BY admin_id ASC');
    return res.json(result.rows || []);
  } catch (err) { return res.status(HTTP.INTERNAL).json({ message: 'Server error' }); }
};

export const deleteAdmin = async (req, res) => {
  if (req.admin.role !== ROLES.MAIN_ADMIN)
    return res.status(HTTP.FORBIDDEN).json({ message: 'Forbidden: Only Main Admin can remove accounts' });
  const targetId = Number(req.params.id);
  if (targetId === req.admin.id)
    return res.status(HTTP.BAD_REQUEST).json({ message: 'You cannot delete your own account' });
  try {
    const check = await pool.query('SELECT role, username FROM admins WHERE admin_id = $1', [targetId]);
    if (check.rows.length === 0) return res.status(HTTP.NOT_FOUND).json({ message: 'Admin not found' });
    if (check.rows[0].role === ROLES.MAIN_ADMIN)
      return res.status(HTTP.FORBIDDEN).json({ message: 'Cannot delete another Main Admin' });
    const deletedUsername = check.rows[0].username;
    await pool.query('DELETE FROM admins WHERE admin_id = $1', [targetId]);
    await safeAudit(req.admin.id, `Deleted admin: ${deletedUsername}`);
    await safeLog('SYSTEM', req.admin.name, `Deleted admin account: ${deletedUsername}`);
    return res.json({ message: `Admin "${deletedUsername}" deleted successfully` });
  } catch (err) { return res.status(HTTP.INTERNAL).json({ error: 'Unable to delete admin' }); }
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const result = await pool.query('SELECT admin_id, password FROM admins WHERE admin_id = $1', [req.admin.id]);
    if (result.rows.length === 0) return res.status(HTTP.NOT_FOUND).json({ message: 'Admin not found' });
    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isMatch) return res.status(HTTP.UNAUTHORIZED).json({ message: 'Current password is incorrect' });
    if (currentPassword === newPassword)
      return res.status(HTTP.BAD_REQUEST).json({ message: 'New password must differ from current password' });
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE admins SET password = $1 WHERE admin_id = $2', [hashed, req.admin.id]);
    await safeLog('SYSTEM', req.admin.name, 'Changed their password');
    await safeAudit(req.admin.id, 'Changed password');
    return res.json({ message: 'Password updated successfully' });
  } catch (err) { return res.status(HTTP.INTERNAL).json({ error: 'Unable to change password' }); }
};

export const getAuditLogs = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT al.id, al.action, al.target_type, al.created_at,
              a.username AS admin_name, a.role AS admin_role
       FROM admin_logs al
       LEFT JOIN admins a ON a.admin_id = al.admin_id
       ORDER BY al.created_at DESC LIMIT $1`, [AUDIT_LIMIT]);
    return res.json(result.rows || []);
  } catch (err) { return res.status(HTTP.INTERNAL).json({ error: 'Unable to fetch audit logs' }); }
};

export const createAuditLog = async (req, res) => {
  const { action, target_type = 'general' } = req.body;
  try {
    await pool.query('INSERT INTO admin_logs (admin_id, action, target_type) VALUES ($1, $2, $3)',
      [req.admin.id, action, target_type]);
    return res.json({ success: true });
  } catch (err) { return res.status(HTTP.INTERNAL).json({ error: 'Unable to create audit log' }); }
};
