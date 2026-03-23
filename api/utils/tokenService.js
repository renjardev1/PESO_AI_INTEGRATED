import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import {
  JWT_SECRET, JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES, JWT_REFRESH_EXPIRES, REFRESH_TOKEN_TTL_DAYS,
} from '../config/index.js';

export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const signAccessToken = (admin) =>
  jwt.sign({ id: admin.id, name: admin.name, role: admin.role }, JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES });

export const signRefreshToken = (admin) => {
  const jti = crypto.randomUUID();
  return jwt.sign({ sub: admin.id, role: admin.role, jti }, JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES });
};

export const verifyAccessToken  = (token) => jwt.verify(token, JWT_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, JWT_REFRESH_SECRET);

export const persistRefreshToken = async (adminId, refreshToken) => {
  const tokenHash = hashToken(refreshToken);
  await pool.query(
    `INSERT INTO admin_refresh_tokens (admin_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))`,
    [adminId, tokenHash, REFRESH_TOKEN_TTL_DAYS]);
  return tokenHash;
};

export const revokeRefreshToken = async (refreshToken) => {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await pool.query(
    `UPDATE admin_refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash]);
};

export const revokeAllRefreshTokensForAdmin = async (adminId) => {
  await pool.query(
    `UPDATE admin_refresh_tokens SET revoked_at = NOW()
     WHERE admin_id = $1 AND revoked_at IS NULL`, [adminId]);
};

export const findActiveRefreshToken = async (refreshToken) => {
  const tokenHash = hashToken(refreshToken);
  const result = await pool.query(
    `SELECT id, admin_id, expires_at, revoked_at FROM admin_refresh_tokens
     WHERE token_hash = $1 LIMIT 1`, [tokenHash]);
  return result.rows[0] || null;
};

export const rotateRefreshToken = async (refreshToken, admin) => {
  const existing = await findActiveRefreshToken(refreshToken);
  if (!existing || existing.revoked_at || new Date(existing.expires_at).getTime() <= Date.now())
    return null;
  await revokeRefreshToken(refreshToken);
  const nextRefresh = signRefreshToken(admin);
  await persistRefreshToken(admin.id, nextRefresh);
  return { accessToken: signAccessToken(admin), refreshToken: nextRefresh };
};
