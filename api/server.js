// ============================================================
// PESO AI — Unified Server
// Serves both the web admin panel and the mobile app.
//
// Two auth systems running in parallel:
//   Web admin  → POST /api/auth/login → HttpOnly cookie + refresh token
//                Reads from: admins table
//   Mobile user → POST /api/login    → Bearer token in JSON body
//                Reads from: users table
// ============================================================
import 'dotenv/config';
import express      from 'express';
import helmet       from 'helmet';
import cors         from 'cors';
import cookieParser from 'cookie-parser';
import http         from 'http';
import { Server }   from 'socket.io';
import cron         from 'node-cron';

import csrfMiddleware                  from './middleware/csrfMiddleware.js';
import { authLimiter, refreshLimiter, globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFound }      from './middleware/errorHandler.js';

// ── Web admin routes ──────────────────────────────────────────────────────────
import authRoutes        from './routes/auth.js';
import logRoutes         from './routes/logs.js';
import userRoutes        from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import backupRoutes      from './routes/backups.js';

// ── Mobile user routes ────────────────────────────────────────────────────────
import mobileAuthRoutes  from './modules/auth/auth.routes.js';
import mobileUserRoutes  from './modules/user/user.routes.js';
import transactionRoutes from './modules/transactions/transactions.routes.js';
import goalRoutes        from './modules/goals/goals.routes.js';
import analyticsRoutes   from './modules/analytics/analytics.routes.js';

// ── Shared admin/superadmin routes (web auth, reads admins table) ─────────────
import adminRoutes       from './modules/admin/admin.routes.js';
import superadminRoutes  from './modules/superadmin/superadmin.routes.js';

import { CORS_ORIGINS, PORT, NODE_ENV } from './config/index.js';

const app = express();

// ── Security middleware ───────────────────────────────────────────────────────
app.use(cookieParser());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'blob:'],
      connectSrc:  ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return; }
    const allowed = CORS_ORIGINS.some(e => e instanceof RegExp ? e.test(origin) : e === origin);
    allowed ? callback(null, true) : callback(new Error('CORS origin not allowed'));
  },
  credentials:    true,
  methods:        ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/refresh',  refreshLimiter);
app.use('/api/login',         authLimiter);   // mobile login also rate-limited
app.use('/api',               globalLimiter);

// ── CSRF (web admin routes; mobile Bearer routes auto-exempt) ─────────────────
app.use(csrfMiddleware);

// ── Health & public status ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// Public maintenance status — mobile polls this on foreground resume (no auth)
import pool from './config/db.js';
app.get('/api/status', async (_req, res) => {
  try {
    const r = await pool.query('SELECT is_active, title, message FROM maintenance_mode WHERE id=1');
    const row = r.rows[0] || { is_active: false };
    return res.json({ success: true, maintenance: { isActive: row.is_active, title: row.title, message: row.message } });
  } catch { return res.json({ success: true, maintenance: { isActive: false } }); }
});

// ── Web admin routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api',      logRoutes);
app.use('/api',      userRoutes);
app.use('/api',      maintenanceRoutes);
app.use('/api',      backupRoutes);

// ── Mobile user routes (all preserved at original /api/* paths) ───────────────
app.use('/api', mobileAuthRoutes);
app.use('/api', mobileUserRoutes);
app.use('/api', transactionRoutes);
app.use('/api', goalRoutes);
app.use('/api', analyticsRoutes);

// ── Shared admin/superadmin panel routes (web session auth) ───────────────────
app.use('/api/admin',      adminRoutes);
app.use('/api/superadmin', superadminRoutes);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
app.set('io', io);

import { setIo }                     from './shared/utils/socket_emitter.js';
import { setIo as setAnnouncementIo } from './modules/announcements/announcements.controller.js';
setIo(io);
setAnnouncementIo(io);

io.on('connection', (socket) => {
  // Mobile users join their personal room after login
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`[Socket] User ${userId} joined room user:${userId}`);
  });
  socket.on('disconnect', () => console.log(`[Socket] Disconnected: ${socket.id}`));
});

// ── Scheduled Jobs ────────────────────────────────────────────────────────────
import { checkBudgetAlerts, runDailyReminders } from './modules/user/notification.controller.js';
import { processDueRecurring }                  from './modules/user/recurring.controller.js';

cron.schedule('0 * * * *',   async () => { await checkBudgetAlerts(); });
cron.schedule('0 0 * * *',   async () => { await processDueRecurring(); });
cron.schedule('0  8 * * *',  async () => { await runDailyReminders(8,  'Asia/Manila'); }, { timezone: 'Asia/Manila' });
cron.schedule('0 13 * * *',  async () => { await runDailyReminders(13, 'Asia/Manila'); }, { timezone: 'Asia/Manila' });
cron.schedule('0 20 * * *',  async () => { await runDailyReminders(20, 'Asia/Manila'); }, { timezone: 'Asia/Manila' });

// ── Debug routes (development only) ──────────────────────────────────────────
if (NODE_ENV !== 'production') {
  const debug = express.Router();
  debug.post('/run-budget-alert',   async (req, res) => { await checkBudgetAlerts();    res.json({ success: true }); });
  debug.post('/run-recurring',      async (req, res) => { await processDueRecurring();   res.json({ success: true }); });
  debug.post('/run-daily-reminder', async (req, res) => {
    const hour = req.body?.hour ?? new Date().getHours();
    const tz   = req.body?.timezone || 'Asia/Manila';
    const r    = await runDailyReminders(hour, tz);
    res.json({ success: true, usersProcessed: r.length });
  });
  app.use('/debug', debug);
}

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export { httpServer, io };
export default app;
