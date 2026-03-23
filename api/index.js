import 'dotenv/config';
import { httpServer } from './server.js';
import pool from './config/db.js';
import { PORT } from './config/index.js';
import seedAdmins from './seed.js';

async function initSchema() {
  try {
    // Web admin tables
    await pool.query(`CREATE TABLE IF NOT EXISTS public.admins (
      admin_id     SERIAL PRIMARY KEY,
      username     VARCHAR(100) NOT NULL UNIQUE,
      password     TEXT NOT NULL,
      role         VARCHAR(50)  NOT NULL DEFAULT 'Staff Admin',
      avatar       TEXT,
      display_name VARCHAR(100),
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS public.system_logs (
      id        SERIAL PRIMARY KEY,
      type      VARCHAR(20),
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      user_name VARCHAR(100),
      message   TEXT
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS public.admin_logs (
      id          SERIAL PRIMARY KEY,
      admin_id    INTEGER,
      action      TEXT,
      target_type VARCHAR(50) DEFAULT 'general',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS public.admin_refresh_tokens (
      id         SERIAL PRIMARY KEY,
      admin_id   INTEGER NOT NULL REFERENCES public.admins(admin_id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_refresh_tokens_admin_id
      ON public.admin_refresh_tokens (admin_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_refresh_tokens_token_hash
      ON public.admin_refresh_tokens (token_hash)`);

    // Global categories table (used by web analytics)
    await pool.query(`CREATE TABLE IF NOT EXISTS public.categories (
      id        SERIAL PRIMARY KEY,
      user_id   UUID REFERENCES public.users(id) ON DELETE CASCADE,
      name      VARCHAR(100) NOT NULL,
      type      VARCHAR(20)  NOT NULL CHECK (type IN ('income','expense')),
      color_hex VARCHAR(20)  DEFAULT '#607D8B',
      icon      VARCHAR(50)  DEFAULT 'tag',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // New tables needed by mobile RBAC + announcements
    await pool.query(`CREATE TABLE IF NOT EXISTS public.maintenance_mode (
      id         SERIAL PRIMARY KEY,
      is_active  BOOLEAN      NOT NULL DEFAULT FALSE,
      title      VARCHAR(200) NOT NULL DEFAULT 'Maintenance in Progress',
      message    TEXT         NOT NULL DEFAULT 'We are performing scheduled maintenance. Please try again later.',
      ends_at    TIMESTAMPTZ,
      updated_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER      REFERENCES public.admins(admin_id) ON DELETE SET NULL
    )`);
    await pool.query(`INSERT INTO public.maintenance_mode (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);

    await pool.query(`CREATE TABLE IF NOT EXISTS public.announcements (
      id         SERIAL PRIMARY KEY,
      title      VARCHAR(200) NOT NULL,
      body       TEXT         NOT NULL,
      priority   VARCHAR(10)  NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
      is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
      created_by INTEGER      REFERENCES public.admins(admin_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_announcements_active
      ON public.announcements (is_active, created_at DESC)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS public.access_logs (
      id              SERIAL PRIMARY KEY,
      actor_id        INTEGER      NOT NULL,
      actor_role      VARCHAR(50)  NOT NULL,
      target_user_id  UUID         REFERENCES public.users(id) ON DELETE SET NULL,
      method          VARCHAR(10)  NOT NULL,
      endpoint        TEXT         NOT NULL,
      accessed_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_actor ON public.access_logs (actor_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_time  ON public.access_logs (accessed_at DESC)`);

    // Column additions to existing tables
    await pool.query(`ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS avatar        TEXT`);
    await pool.query(`ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS display_name  VARCHAR(100)`);
    await pool.query(`ALTER TABLE public.users  ADD COLUMN IF NOT EXISTS location       VARCHAR(100)`);
    await pool.query(`ALTER TABLE public.users  ADD COLUMN IF NOT EXISTS phone          VARCHAR(20)`);
    await pool.query(`ALTER TABLE public.users  ADD COLUMN IF NOT EXISTS is_disabled    BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE public.users  ADD COLUMN IF NOT EXISTS disabled_reason TEXT`);
    await pool.query(`ALTER TABLE public.users  ADD COLUMN IF NOT EXISTS disabled_at    TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE public.users  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ`);

    console.log('✅ Schema initialised');
  } catch (err) {
    console.error('⚠️  Schema init warning:', err.message);
  }
}

async function start() {
  await initSchema();
  await seedAdmins();
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀  PESO AI Unified API running → http://localhost:${PORT}`);
    console.log('    Web admin:  /api/auth/*  |  /api/admin/*  |  /api/superadmin/*');
    console.log('    Mobile:     /api/login   |  /api/transactions/*  |  /api/goals/*  |  ...');
    console.log('    WebSocket:  socket.io ready');
  });
}

start().catch(err => { console.error('❌ Failed to start:', err); process.exit(1); });