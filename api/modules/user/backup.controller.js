import pool from '../../config/db.js';

// ── POST /backup/:userId ──────────────────────────────────────────────────────
// Snapshots profile + transactions + goals + contributions into the backups table

const createBackup = async (req, res) => {
    const { userId } = req.params;

    // FIX: req.body may be undefined if the Android client sends no body or
    //      if express.json() middleware isn't on this route. Use safe access.
    const backup_type = (req.body && req.body.backup_type) ? req.body.backup_type : 'manual';

    try {
        const [profile, transactions, goals, contributions] = await Promise.all([
            pool.query('SELECT * FROM user_profiles    WHERE user_id = $1', [userId]),
            pool.query('SELECT * FROM transactions     WHERE user_id = $1', [userId]),
            pool.query('SELECT * FROM savings_goals    WHERE user_id = $1', [userId]),
            pool.query(
                `SELECT gc.*
                 FROM goal_contributions gc
                 JOIN savings_goals sg ON gc.goal_id = sg.id
                 WHERE sg.user_id = $1`,
                [userId]
            )
        ]);

        const snapshot = {
            exportedAt:    new Date().toISOString(),
            profile:       profile.rows[0]       || null,
            transactions:  transactions.rows,
            goals:         goals.rows,
            contributions: contributions.rows
        };

        const dataStr  = JSON.stringify(snapshot);
        const result   = await pool.query(
            `INSERT INTO backups (user_id, backup_type, file_size_bytes, data)
             VALUES ($1, $2, $3, $4)
             RETURNING id, created_at`,
            [userId, backup_type, Buffer.byteLength(dataStr, 'utf8'), snapshot]
        );

        res.json({
            success:   true,
            backupId:  result.rows[0].id,
            createdAt: result.rows[0].created_at,
            sizeBytes: Buffer.byteLength(dataStr, 'utf8')
        });
    } catch (err) {
        console.error('[Backup] create:', err);
        res.status(500).json({ success: false, message: 'Failed to create backup' });
    }
};

// ── GET /backup/:userId ───────────────────────────────────────────────────────

const listBackups = async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            `SELECT id, backup_type, file_size_bytes, created_at
             FROM backups
             WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 20`,
            [userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Backup] list:', err);
        res.status(500).json({ success: false, message: 'Failed to list backups' });
    }
};

// ── POST /backup/:userId/restore/:backupId ────────────────────────────────────
// Deletes current data, re-inserts from snapshot; maps old goal IDs to new ones

const restoreBackup = async (req, res) => {
    const { userId, backupId } = req.params;
    const client = await pool.connect();
    try {
        const backup = await client.query(
            `SELECT data FROM backups WHERE id = $1 AND user_id = $2`,
            [backupId, userId]
        );
        if (backup.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Backup not found' });
        }

        const snap = backup.rows[0].data;
        await client.query('BEGIN');

        // Clear current data (FK cascades handle goal_contributions via savings_goals)
        await client.query('DELETE FROM goal_contributions WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM transactions        WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM savings_goals       WHERE user_id = $1', [userId]);

        // Restore transactions
        for (const tx of (snap.transactions || [])) {
            await client.query(
                `INSERT INTO transactions
                 (user_id, amount, category, description, transaction_type, transaction_date, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userId, tx.amount, tx.category, tx.description,
                 tx.transaction_type, tx.transaction_date, tx.created_at]
            );
        }

        // Restore goals and build old→new ID map for contributions
        const goalIdMap = {};
        for (const goal of (snap.goals || [])) {
            const ins = await client.query(
                `INSERT INTO savings_goals
                 (user_id, goal_name, target_amount, current_amount, deadline, category, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [userId, goal.goal_name, goal.target_amount, goal.current_amount,
                 goal.deadline, goal.category, goal.status]
            );
            goalIdMap[goal.id] = ins.rows[0].id;
        }

        // Restore contributions using remapped goal IDs
        for (const contrib of (snap.contributions || [])) {
            const newGoalId = goalIdMap[contrib.goal_id];
            if (newGoalId) {
                await client.query(
                    `INSERT INTO goal_contributions (goal_id, user_id, amount, contribution_date)
                     VALUES ($1, $2, $3, $4)`,
                    [newGoalId, userId, contrib.amount, contrib.contribution_date]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Backup restored successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Backup] restore:', err);
        res.status(500).json({ success: false, message: 'Failed to restore backup' });
    } finally {
        client.release();
    }
};

// ── DELETE /backup/:userId/:backupId ─────────────────────────────────────────

const deleteBackup = async (req, res) => {
    const { userId, backupId } = req.params;
    try {
        await pool.query(
            `DELETE FROM backups WHERE id = $1 AND user_id = $2`,
            [backupId, userId]
        );
        res.json({ success: true, message: 'Backup deleted' });
    } catch (err) {
        console.error('[Backup] delete:', err);
        res.status(500).json({ success: false, message: 'Failed to delete backup' });
    }
};

export { createBackup, listBackups, restoreBackup, deleteBackup };
