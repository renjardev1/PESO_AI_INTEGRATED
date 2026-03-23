import pool from '../../config/db.js';
import bcrypt from 'bcryptjs';

// ── GET /app-lock/:userId ─────────────────────────────────────────────────────

const getAppLock = async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            `SELECT is_enabled, lock_type, timeout_mins
             FROM app_lock_settings WHERE user_id = $1`,
            [userId]
        );
        res.json({
            success: true,
            data: result.rows[0] || { is_enabled: false, lock_type: 'none', timeout_mins: 5 }
        });
    } catch (err) {
        console.error('[AppLock] get:', err);
        res.status(500).json({ success: false, message: 'Failed to get app lock settings' });
    }
};

// ── PUT /app-lock/:userId ─────────────────────────────────────────────────────
// Body: { is_enabled, lock_type, pin (optional), timeout_mins }
// PIN is hashed before storage; existing hash is preserved if no new PIN is sent.

const setAppLock = async (req, res) => {
    const { userId } = req.params;
    const {
        is_enabled,
        lock_type    = 'pin',
        pin,
        timeout_mins = 5
    } = req.body;

    try {
        let pin_hash = null;

        if (lock_type === 'pin' && pin) {
            if (!/^\d{4,6}$/.test(pin)) {
                return res.status(400).json({
                    success: false,
                    message: 'PIN must be 4–6 digits'
                });
            }
            pin_hash = await bcrypt.hash(pin, 10);
        }

        await pool.query(
            `INSERT INTO app_lock_settings
             (user_id, is_enabled, lock_type, pin_hash, timeout_mins)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET
               is_enabled   = EXCLUDED.is_enabled,
               lock_type    = EXCLUDED.lock_type,
               pin_hash     = COALESCE(EXCLUDED.pin_hash, app_lock_settings.pin_hash),
               timeout_mins = EXCLUDED.timeout_mins,
               updated_at   = CURRENT_TIMESTAMP`,
            [userId, is_enabled, lock_type, pin_hash, timeout_mins]
        );

        res.json({ success: true, message: 'App lock settings updated' });
    } catch (err) {
        console.error('[AppLock] set:', err);
        res.status(500).json({ success: false, message: 'Failed to update app lock settings' });
    }
};

// ── POST /app-lock/:userId/verify ─────────────────────────────────────────────
// Body: { pin }

const verifyPin = async (req, res) => {
    const { userId } = req.params;
    const { pin }    = req.body;

    if (!pin) {
        return res.status(400).json({ success: false, message: 'PIN required' });
    }

    try {
        const result = await pool.query(
            `SELECT pin_hash FROM app_lock_settings
             WHERE user_id = $1 AND is_enabled = true`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'App lock not configured' });
        }

        const isMatch = await bcrypt.compare(pin, result.rows[0].pin_hash);
        res.json({
            success: isMatch,
            message: isMatch ? 'PIN correct' : 'Incorrect PIN'
        });
    } catch (err) {
        console.error('[AppLock] verify:', err);
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
};

export { getAppLock, setAppLock, verifyPin };
