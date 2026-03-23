import pool from '../../config/db.js';
import { emitNotification } from '../../shared/utils/socket_emitter.js';
import { MESSAGES } from '../../shared/constants/messages.js';

// ── GET /notifications/:userId ────────────────────────────────────────────────

const getNotifications = async (req, res) => {
    const { userId } = req.params;
    try {
        const [settings, notifications] = await Promise.all([
            pool.query('SELECT * FROM notification_settings WHERE user_id = $1', [userId]),
            pool.query(
                `SELECT * FROM notifications
                 WHERE user_id = $1
                 ORDER BY created_at DESC LIMIT 50`,
                [userId]
            )
        ]);
        res.json({
            success:       true,
            settings:      settings.rows[0] || null,
            notifications: notifications.rows
        });
    } catch (err) {
        console.error('[Notifications] get:', err);
        res.status(500).json({ success: false, message: 'Failed to get notifications' });
    }
};

// ── PUT /notifications/:userId/settings ───────────────────────────────────────

const updateNotificationSettings = async (req, res) => {
    const { userId } = req.params;
    const {
        budget_alerts, budget_alert_threshold,
        daily_reminders, daily_reminder_time,
        push_notifications, share_analytics,
    } = req.body;

    // budget_alert_threshold is stored as numeric(5,2) — max 999.99.
    // Mobile may send a raw peso amount; clamp to a 0-100 percentage.
    const rawThreshold = parseFloat(budget_alert_threshold ?? 80.0);
    const safeThreshold = rawThreshold > 100
        ? Math.min(((rawThreshold / 100) * 100) % 100 || 80.0, 999.99)
        : Math.min(Math.max(rawThreshold, 0), 100);

    try {
        const result = await pool.query(
            `INSERT INTO notification_settings
             (user_id, budget_alerts, budget_alert_threshold,
              daily_reminders, daily_reminder_time, push_notifications, share_analytics)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id) DO UPDATE SET
               budget_alerts          = EXCLUDED.budget_alerts,
               budget_alert_threshold = EXCLUDED.budget_alert_threshold,
               daily_reminders        = EXCLUDED.daily_reminders,
               daily_reminder_time    = EXCLUDED.daily_reminder_time,
               push_notifications     = EXCLUDED.push_notifications,
               share_analytics        = EXCLUDED.share_analytics,
               updated_at             = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                userId,
                budget_alerts      ?? true,
                safeThreshold,
                daily_reminders    ?? false,
                daily_reminder_time ?? '09:00:00',
                push_notifications ?? true,
                share_analytics    ?? true,
            ]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Notifications] updateSettings:', err);
        res.status(500).json({ success: false, message: 'Failed to update notification settings' });
    }
};

// ── PUT /notifications/:userId/:notificationId/read ───────────────────────────

const markRead = async (req, res) => {
    const { userId, notificationId } = req.params;
    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
            [notificationId, userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Notifications] markRead:', err);
        res.status(500).json({ success: false, message: 'Failed to mark as read' });
    }
};

// ── PUT /notifications/:userId/read-all ───────────────────────────────────────

const markAllRead = async (req, res) => {
    const { userId } = req.params;
    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE user_id = $1`,
            [userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Notifications] markAllRead:', err);
        res.status(500).json({ success: false, message: 'Failed to mark all as read' });
    }
};

// ── CRON: Budget alerts (run hourly) ──────────────────────────────────────────

const checkBudgetAlertsForUser = async (userId) => {
    try {
        const userResult = await pool.query(`
            SELECT p.monthly_income
            FROM user_profiles         p
            JOIN notification_settings ns ON p.user_id = ns.user_id
            WHERE p.user_id = $1
              AND ns.budget_alerts = true
              AND p.monthly_income > 0
        `, [userId]);

        if (userResult.rows.length === 0) return;

        const budget = parseFloat(userResult.rows[0].monthly_income);

        const spentResult = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM transactions
             WHERE user_id = $1
               AND transaction_type = 'expense'
               AND DATE_TRUNC('month', transaction_date) =
                   DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date)`,
            [userId]
        );

        const spent = parseFloat(spentResult.rows[0].total);
        const pct   = (spent / budget) * 100;

        const tiers = [
            { threshold: 50,  type: 'budget_alert_50',  title: '💡 Budget Awareness', body: MESSAGES.BUDGET_ALERT_50  },
            { threshold: 80,  type: 'budget_alert_80',  title: '⚠️ Budget Warning',   body: MESSAGES.BUDGET_ALERT_80  },
            { threshold: 100, type: 'budget_alert_100', title: '🚨 Budget Critical',  body: MESSAGES.BUDGET_ALERT_100 },
        ];

        for (const tier of [...tiers].reverse()) {
            if (pct < tier.threshold) continue;

            const alreadySent = await pool.query(
                `SELECT id FROM notifications
                 WHERE user_id = $1 AND type = $2
                   AND DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Manila') =
                       DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date)
                 LIMIT 1`,
                [userId, tier.type]
            );

            if (alreadySent.rows.length === 0) {
                const inserted = await pool.query(
                    `INSERT INTO notifications (user_id, type, title, body)
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [userId, tier.type, tier.title, tier.body]
                );
                const notifRow = inserted.rows[0];
                emitNotification(userId, notifRow);
                await pool.query(
                    `UPDATE notifications SET is_pushed = true WHERE id = $1`,
                    [notifRow.id]
                ).catch(err => console.warn('[Socket] is_pushed update failed:', err.message));
                console.log(`[Budget] Alert ${tier.type} sent for user ${userId} (${Math.round(pct)}%)`);
            }
            break;
        }
    } catch (err) {
        console.error(`[Budget] checkBudgetAlertsForUser error for ${userId}:`, err.message);
    }
};

const checkBudgetAlerts = async () => {
    try {
        const users = await pool.query(`
            SELECT u.id FROM users u
            JOIN user_profiles         p  ON u.id = p.user_id
            JOIN notification_settings ns ON u.id = ns.user_id
            WHERE ns.budget_alerts = true AND p.monthly_income > 0
        `);
        for (const user of users.rows) {
            await checkBudgetAlertsForUser(user.id);
        }
    } catch (err) {
        console.error('[Cron] checkBudgetAlerts error:', err.message);
    }
};

// ── CRON: Daily reminders ─────────────────────────────────────────────────────

// Helpers
function getDailyBudget(monthlyBudget) {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return monthlyBudget / daysInMonth;
}

function getBudgetState(usagePct) {
    if (usagePct > 100) return 'EXCEEDED';
    if (usagePct >= 80)  return 'CRITICAL';
    if (usagePct >= 50)  return 'WARNING';
    return 'SAFE';
}

function getTimePrefix(hour) {
    if (hour >= 6  && hour < 12) return 'Plan ahead —';
    if (hour >= 12 && hour < 18) return 'Quick check —';
    if (hour >= 18 && hour < 23) return 'Last check —';
    return null;
}

function pickTemplate(state, remaining, excess) {
    const fmt = (n) => {
        const parts = Math.abs(n).toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    };
    const templates = {
        SAFE: [
            `You're doing great — PHP ${fmt(remaining)} left today.`,
            `Plenty of budget left — PHP ${fmt(remaining)}.`,
            `You're on track — PHP ${fmt(remaining)} remaining today.`,
        ],
        WARNING: [
            `You've used over half your budget. PHP ${fmt(remaining)} left.`,
            `Keep an eye on your spending — PHP ${fmt(remaining)} remaining.`,
            `Budget halfway gone — PHP ${fmt(remaining)} left today.`,
        ],
        CRITICAL: [
            `Careful — only PHP ${fmt(remaining)} left today.`,
            `You're close to your limit — PHP ${fmt(remaining)} left.`,
            `Almost at your daily limit — PHP ${fmt(remaining)} remaining.`,
        ],
        EXCEEDED: [
            `You've exceeded your budget by PHP ${fmt(excess)}.`,
            `Daily budget exceeded by PHP ${fmt(excess)}.`,
            `Over budget today by PHP ${fmt(excess)}.`,
        ],
    };
    const list = templates[state] || templates.SAFE;
    return list[Math.floor(Math.random() * list.length)];
}

function getTrendInsight(todaySpent, avgLast7) {
    if (avgLast7 <= 0) return null;
    const ratio = todaySpent / avgLast7;
    if (ratio > 1.2) return "You're spending faster than usual.";
    if (ratio < 0.8) return "You're spending less than usual — nice progress.";
    return null;
}

// Process one user for daily reminder
const processDailyReminderForUser = async (userId, hour, timezone = 'Asia/Manila') => {
    const timePrefix = getTimePrefix(hour);
    if (!timePrefix) return { skipped: true, reason: 'Outside reminder hours' };

    // Suppression — max 2 reminders today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const recentReminders = await pool.query(
        `SELECT COUNT(*) AS count FROM notifications
         WHERE user_id = $1 AND type = 'DAILY_REMINDER' AND created_at >= $2`,
        [userId, todayStart.toISOString()]
    );
    if (parseInt(recentReminders.rows[0].count, 10) >= 2) {
        return { skipped: true, reason: 'Max reminders reached for today' };
    }

    // Suppression — recent budget alert within last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentAlerts = await pool.query(
        `SELECT COUNT(*) AS count FROM notifications
         WHERE user_id = $1
           AND type IN ('budget_alert_50', 'budget_alert_80', 'budget_alert_100')
           AND created_at >= $2`,
        [userId, twoHoursAgo.toISOString()]
    );
    if (parseInt(recentAlerts.rows[0].count, 10) > 0) {
        return { skipped: true, reason: 'Recent budget alert suppresses reminder' };
    }

    // Check user has daily_reminders enabled in settings
    const settingsResult = await pool.query(
        `SELECT ns.daily_reminders, p.monthly_expenses
         FROM notification_settings ns
         JOIN user_profiles p ON p.user_id = ns.user_id
         WHERE ns.user_id = $1`,
        [userId]
    );
    if (!settingsResult.rows.length) return { skipped: true, reason: 'No settings found' };

    const { daily_reminders, monthly_expenses } = settingsResult.rows[0];
    if (!daily_reminders) return { skipped: true, reason: 'Daily reminders disabled by user' };

    const monthlyBudget = parseFloat(monthly_expenses || 0);
    if (monthlyBudget <= 0) return { skipped: true, reason: 'No budget configured' };

    const dailyBudget = getDailyBudget(monthlyBudget);

    // Today's spending + count
    const todayResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM transactions
         WHERE user_id = $1
           AND transaction_type = 'expense'
           AND transaction_date = CURRENT_DATE AT TIME ZONE $2`,
        [userId, timezone]
    );
    const todaySpent = parseFloat(todayResult.rows[0].total);
    const todayCount = parseInt(todayResult.rows[0].count, 10);

    // No activity — engagement reminder
    if (todayCount === 0) {
        const title = '📋 Daily Check-In';
        const body  = `${timePrefix} No expenses logged today — did you spend anything?`;
        const inserted = await pool.query(
            `INSERT INTO notifications (user_id, type, title, body, priority, is_read, is_pushed)
             VALUES ($1, 'DAILY_REMINDER', $2, $3, 'low', FALSE, FALSE) RETURNING *`,
            [userId, title, body]
        );
        emitNotification(userId, inserted.rows[0]);
        return { sent: true, title, body, state: 'NO_ACTIVITY' };
    }

    // Highly active + safe — suppress
    const usagePct = dailyBudget > 0 ? (todaySpent / dailyBudget) * 100 : 0;
    const state    = getBudgetState(usagePct);
    if (todayCount >= 5 && state === 'SAFE') {
        return { skipped: true, reason: 'Highly active and budget safe' };
    }

    // Template
    const remaining = dailyBudget - todaySpent;
    const excess    = todaySpent - dailyBudget;
    const template  = pickTemplate(state, remaining, excess);

    // Trend
    const trendResult = await pool.query(
        `SELECT COALESCE(AVG(daily_total), 0) AS avg
         FROM (
             SELECT transaction_date, SUM(amount) AS daily_total
             FROM transactions
             WHERE user_id = $1
               AND transaction_type = 'expense'
               AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'
               AND transaction_date < CURRENT_DATE
             GROUP BY transaction_date
         ) sums`,
        [userId]
    );
    const avgLast7  = parseFloat(trendResult.rows[0].avg);
    const trendText = getTrendInsight(todaySpent, avgLast7);

    const priority = state === 'EXCEEDED' || state === 'CRITICAL' ? 'high'
                   : state === 'WARNING' ? 'normal'
                   : 'low';

    const title = state === 'EXCEEDED' ? '🚨 Budget Exceeded'
                : state === 'CRITICAL' ? '⚠️ Budget Critical'
                : state === 'WARNING'  ? '💡 Budget Warning'
                : '✅ Daily Summary';

    const body = [timePrefix, template, trendText].filter(Boolean).join(' ');

    const inserted = await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, priority, is_read, is_pushed)
         VALUES ($1, 'DAILY_REMINDER', $2, $3, $4, FALSE, FALSE) RETURNING *`,
        [userId, title, body, priority]
    );
    emitNotification(userId, inserted.rows[0]);

    return { sent: true, title, body, state, priority };
};

// Run daily reminders for all eligible users
const runDailyReminders = async (hour, timezone = 'Asia/Manila') => {
    console.log(`[DailyReminder] Running for hour=${hour} at ${new Date().toISOString()}`);
    try {
        const users = await pool.query(`
            SELECT u.id, u.email
            FROM users u
            JOIN user_profiles         p  ON u.id = p.user_id
            JOIN notification_settings ns ON u.id = ns.user_id
            WHERE ns.daily_reminders = true
              AND p.monthly_expenses > 0
        `);

        console.log(`[DailyReminder] Processing ${users.rows.length} user(s)`);
        const results = [];

        for (const user of users.rows) {
            try {
                const result = await processDailyReminderForUser(user.id, hour, timezone);
                if (result.sent) {
                    console.log(`[DailyReminder] Sent to ${user.email}: "${result.body}"`);
                } else {
                    console.log(`[DailyReminder] Skipped ${user.email}: ${result.reason}`);
                }
                results.push({ userId: user.id, email: user.email, ...result });
            } catch (e) {
                console.error(`[DailyReminder] Error for ${user.email}:`, e.message);
                results.push({ userId: user.id, email: user.email, error: e.message });
            }
        }
        return results;
    } catch (err) {
        console.error('[DailyReminder] Fatal error:', err.message);
        return [];
    }
};


// ── POST /api/notifications/daily/:userId  (manual per-user trigger) ──────────
// Allows the app to request a daily reminder for a specific user on demand.
// Uses the current server hour to build a contextual message.
const triggerDailyReminder = async (req, res) => {
    const { userId } = req.params;
    try {
        const now      = new Date();
        const hour     = parseInt(req.query.hour ?? now.getHours(), 10);
        const timezone = req.query.timezone || 'Asia/Manila';
        const result   = await processDailyReminderForUser(userId, hour, timezone);
        if (result.skipped) {
            return res.json({ success: true, skipped: true, reason: result.reason });
        }
        return res.json({ success: true, sent: true });
    } catch (err) {
        console.error('[Notifications] triggerDailyReminder:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to trigger daily reminder.' });
    }
};

export { getNotifications,
    updateNotificationSettings,
    markRead,
    markAllRead,
    checkBudgetAlerts,
    checkBudgetAlertsForUser,
    processDailyReminderForUser,
    runDailyReminders,
    triggerDailyReminder, };