import 'dotenv/config';

// ── Server ────────────────────────────────────────────────────────────────────
export const PORT     = process.env.PORT     || 3000;
export const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Web admin JWT (short-lived access + long-lived refresh) ───────────────────
export const JWT_SECRET          = process.env.JWT_SECRET          || 'pesoi_super_secret_key_2026';
export const JWT_REFRESH_SECRET  = process.env.JWT_REFRESH_SECRET  || `${process.env.JWT_SECRET || 'pesoi_super_secret_key_2026'}_refresh`;
export const JWT_ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES  || '15m';
export const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
export const REFRESH_TOKEN_TTL_DAYS = 7;

// ── Mobile user JWT (long-lived Bearer token) ─────────────────────────────────
// Uses the same JWT_SECRET — tokens are distinguished by payload shape:
//   Web admin token:  { id, name, role }  — issued by web auth flow
//   Mobile user token: { id, role }        — issued by mobile login flow
export const JWT_EXPIRY = process.env.JWT_EXPIRY || '1d';

// ── Cookies (web admin only) ──────────────────────────────────────────────────
export const COOKIE_SECURE        = process.env.NODE_ENV === 'production';
export const COOKIE_SAME_SITE     = 'lax';
export const ACCESS_COOKIE_NAME   = 'token';
export const REFRESH_COOKIE_NAME  = 'refreshToken';

// ── Email ─────────────────────────────────────────────────────────────────────
export const GMAIL_USER = process.env.GMAIL_USER;
export const GMAIL_PASS = process.env.GMAIL_PASS;
export const APP_NAME   = process.env.APP_NAME || 'PESO AI';

// ── AI service ────────────────────────────────────────────────────────────────
export const LLAMA_URL = process.env.LLAMA_URL || 'http://127.0.0.1:8080';

// ── Backup ────────────────────────────────────────────────────────────────────
export const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'pesoi_super_secret_key_2026';

// ── Database connection config ────────────────────────────────────────────────
export const DB_CONFIG = process.env.DB_URL
  ? { connectionString: process.env.DB_URL }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

// ── CORS ──────────────────────────────────────────────────────────────────────
export const CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'exp://127.0.0.1:19000',
  'capacitor://localhost',
  /^http:\/\/192\.168\./,
  /^http:\/\/10\./,
];
