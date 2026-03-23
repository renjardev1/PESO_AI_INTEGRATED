import pool from '../../config/db.js';
import { emitNotification } from '../../shared/utils/socket_emitter.js';

const VALID_FREQUENCIES   = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'];
const VALID_TYPES = ['expense'];
const ALLOWED_UPDATE_KEYS = [
    'amount', 'category', 'description', 'transaction_type',
    'frequency', 'repeat_interval', 'start_date', 'end_date',
    'reminder_enabled', 'reminder_days_before', 'status'
];

// ── GET /recurring/:userId ────────────────────────────────────────────────────

const getRecurring = async (req, res) => {
    const { userId } = req.params;
    const { status } = req.query;  // ← ADD THIS
    
    try {
        let whereClause = 'WHERE user_id = $1';
        
        // ← ADD THIS LOGIC
        if (status === 'active') {
            whereClause += ` AND status = 'active'`;
        } else if (status === 'cancelled') {
            whereClause += ` AND status = 'cancelled'`;
        } else if (status === 'completed') {
            whereClause += ` AND status = 'completed'`;
        } else if (status === null || status === undefined) {
        // Show active only (default behavior)
            whereClause += ` AND status = 'active'`;
        }
        // If status = 'all' or any other value, show everything
        
        const result = await pool.query(
            `SELECT *,
                    TO_CHAR(next_run_date, 'YYYY-MM-DD') AS next_run_date_fmt,
                    TO_CHAR(start_date,    'YYYY-MM-DD') AS start_date_fmt,
                    TO_CHAR(end_date,      'YYYY-MM-DD') AS end_date_fmt,
                    TO_CHAR(completed_at,  'YYYY-MM-DD') AS completed_at_fmt
             FROM recurring_transactions
             ${whereClause}
             ORDER BY recurring_transactions.next_run_date ASC`,
            [userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Recurring] getRecurring:', err);
        res.status(500).json({ success: false, message: 'Failed to get recurring transactions' });
    }
};

// ── POST /recurring/:userId ───────────────────────────────────────────────────

const createRecurring = async (req, res) => {
    const { userId } = req.params;
    const {
        amount,
        category,
        description,
        transaction_type,
        frequency,
        repeat_interval    = 1,
        start_date,
        end_date,
        reminder_enabled   = false,
        reminder_days_before = 1
    } = req.body;

    // Validate
    if (!amount || amount <= 0)
        return res.status(400).json({ success: false, message: 'Invalid amount' });
    if (!VALID_TYPES.includes(transaction_type))
        return res.status(400).json({ success: false, message: 'Invalid transaction_type' });
    if (!VALID_FREQUENCIES.includes(frequency))
        return res.status(400).json({ success: false, message: 'Invalid frequency' });
    if (!start_date)
        return res.status(400).json({ success: false, message: 'start_date required' });

    try {
        const result = await pool.query(
            `INSERT INTO recurring_transactions
             (user_id, amount, category, description, transaction_type,
              frequency, repeat_interval, start_date, end_date,
              next_run_date, reminder_enabled, reminder_days_before)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$8,$10,$11)
             RETURNING *`,
            [
                userId, amount, category, description, transaction_type,
                frequency, repeat_interval, start_date, end_date,
                reminder_enabled, reminder_days_before
            ]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Recurring] create:', err);
        res.status(500).json({ success: false, message: 'Failed to create recurring transaction' });
    }
};

// ── PUT /recurring/:userId/:recurringId ───────────────────────────────────────
// Accepts partial updates; only permitted fields are applied

const updateRecurring = async (req, res) => {
    const { userId, recurringId } = req.params;
    const fields  = req.body;
    let updates = Object.keys(fields).filter(k => ALLOWED_UPDATE_KEYS.includes(k));

    if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid fields provided' });
    }

    // When start_date changes, sync next_run_date to the new start date
    if (updates.includes('start_date')) {
        updates = [...updates, 'next_run_date'];
        fields['next_run_date'] = fields['start_date'];
    }

    const setClauses = updates.map((k, i) => `${k} = $${i + 3}`).join(', ');
    const values     = [userId, recurringId, ...updates.map(k => fields[k])];

    try {
        const result = await pool.query(
            `UPDATE recurring_transactions
             SET ${setClauses}
             WHERE user_id = $1 AND id = $2
             RETURNING *`,
            values
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Recurring transaction not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Recurring] update:', err);
        res.status(500).json({ success: false, message: 'Failed to update recurring transaction' });
    }
};

// ── PUT /recurring/:userId/:recurringId/cancel ────────────────────────────────
// Soft-delete: sets status = 'cancelled'

const cancelRecurring = async (req, res) => {
    const { userId, recurringId } = req.params;
    try {
        await pool.query(
            `UPDATE recurring_transactions SET status = 'cancelled'
             WHERE user_id = $1 AND id = $2`,
            [userId, recurringId]
        );
        res.json({ success: true, message: 'Recurring transaction cancelled' });
    } catch (err) {
        console.error('[Recurring] cancel:', err);
        res.status(500).json({ success: false, message: 'Failed to cancel recurring transaction' });
    }
};

// ── DELETE /recurring/:userId/:recurringId ────────────────────────────────────
// Hard-delete: permanently removes the record

const deleteRecurring = async (req, res) => {
    const { userId, recurringId } = req.params;
    try {
        const result = await pool.query(
            `DELETE FROM recurring_transactions 
             WHERE user_id = $1 AND id = $2
             RETURNING *`,
            [userId, recurringId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Recurring transaction not found' });
        }
        
        res.json({ success: true, message: 'Recurring transaction permanently deleted' });
    } catch (err) {
        console.error('[Recurring] delete:', err);
        res.status(500).json({ success: false, message: 'Failed to delete recurring transaction' });
    }
};

// ── CRON: process due recurring transactions (run every midnight) ─────────────
// Called from server.js. Uses a transaction + explicit BEGIN/COMMIT.

const processDueRecurring = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const due = await client.query(
            `SELECT *
             FROM recurring_transactions
             WHERE status = 'active'
               AND next_run_date <= CURRENT_DATE
               AND (end_date IS NULL OR end_date >= CURRENT_DATE)`
        );

        for (const rec of due.rows) {
            await client.query(
                `INSERT INTO transactions
                (user_id, amount, category, description, transaction_type,
                transaction_date, is_recurring, recurring_id, status)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, 'paid')`,
            [
                rec.user_id, rec.amount, rec.category,
                rec.description || null,
                rec.transaction_type, rec.next_run_date, rec.id
            ]
        );

            // Advance next_run_date by the configured interval
            let interval;
            switch (rec.frequency) {
                case 'daily':    interval = `${rec.repeat_interval} days`;              break;
                case 'weekly':   interval = `${rec.repeat_interval * 7} days`;          break;
                case 'biweekly': interval = `${rec.repeat_interval * 14} days`;         break;
                case 'monthly':  interval = `${rec.repeat_interval} months`;            break;
                case 'yearly':   interval = `${rec.repeat_interval} years`;             break;
                default:         interval = '1 month';
            }

            // Phase 3 fix: fetch the NEW next_run_date AFTER advancing so the
            // reminder is scheduled relative to the next upcoming occurrence,
            // not the one we just processed.
            const advanceResult = await client.query(
                `UPDATE recurring_transactions
                 SET next_run_date = next_run_date + $1::INTERVAL
                 WHERE id = $2
                 RETURNING next_run_date`,
                [interval, rec.id]
            );

            // Queue a reminder notification if enabled
            if (rec.reminder_enabled) {
                const newNextRunDate = advanceResult.rows[0].next_run_date;
                const reminderDate   = new Date(newNextRunDate);
                reminderDate.setDate(reminderDate.getDate() - (rec.reminder_days_before || 1));
                const nowPH = new Date(
                    new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
                );
                if (reminderDate > nowPH) {
                    const reminderInsert = await client.query(
                        `INSERT INTO notifications (user_id, type, title, body, scheduled_at)
                         VALUES ($1, 'recurring', $2, $3, $4)
                         RETURNING *`,
                        [
                            rec.user_id,
                            'Upcoming Recurring Transaction',
                            `Reminder: ₱${rec.amount} for ${rec.category} is due on ${new Date(newNextRunDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`,
                            reminderDate
                        ]
                    );
                    emitNotification(rec.user_id, reminderInsert.rows[0]);
                }
            }
            // Check if this is the last occurrence (end_date exists and next occurrence would exceed it)
            if (rec.end_date) {
                const nextRunDate = new Date(advanceResult.rows[0].next_run_date);
                const endDate = new Date(rec.end_date);
                
                    // If next run date exceeds end date, this was the last occurrence
                    if (nextRunDate > endDate) {
                    // Mark as completed (naturally finished)
                    await client.query(
                        `UPDATE recurring_transactions
                        SET status = 'completed', completed_at = CURRENT_DATE
                        WHERE id = $1`,
                        [rec.id]
                    );

                    // Send "recurring ended" notification
                    const endedInsert = await client.query(
                        `INSERT INTO notifications (user_id, type, title, body, priority)
                        VALUES ($1, 'recurring_ended', $2, $3, 'normal')
                        RETURNING *`,
                        [
                            rec.user_id,
                            '✓ Recurring Transaction Completed',
                            `Your recurring payment for ${rec.category} (₱${rec.amount}) has ended. No more automatic charges will be created.`
                        ]
                    );
                    emitNotification(rec.user_id, endedInsert.rows[0]);
                }
            }
        }

        await client.query('COMMIT');
        console.log(`[Cron] Processed ${due.rows.length} recurring transactions`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Cron] processDueRecurring error:', err);
    } finally {
        client.release();
    }
};

// ── POST /recurring/:userId/:recurringId/pay ──────────────────────────────────
// Creates a real expense transaction, advances next_run_date, fires reminder.

const markRecurringAsPaid = async (req, res) => {
    const { userId, recurringId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch the recurring row
        const recResult = await client.query(
            `SELECT * FROM recurring_transactions
             WHERE id = $1 AND user_id = $2 AND status = 'active'`,
            [parseInt(recurringId, 10), userId]
        );
        if (recResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Recurring transaction not found' });
        }
        const rec = recResult.rows[0];

        // 2. Insert expense transaction (reuse same logic as processDueRecurring)
        await client.query(
            `INSERT INTO transactions
            (user_id, amount, category, description, transaction_type,
            transaction_date, is_recurring, recurring_id, status)
            VALUES ($1, $2, $3, $4, 'expense',
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date,
            TRUE, $5, 'paid')`,
            [userId, rec.amount, rec.category, rec.description || null, parseInt(recurringId, 10)]
        );

        // 3. Advance next_run_date
        let interval;
        switch (rec.frequency) {
            case 'daily':    interval = `${rec.repeat_interval} days`;      break;
            case 'weekly':   interval = `${rec.repeat_interval * 7} days`;  break;
            case 'biweekly': interval = `${rec.repeat_interval * 14} days`; break;
            case 'monthly':  interval = `${rec.repeat_interval} months`;    break;
            case 'yearly':   interval = `${rec.repeat_interval} years`;     break;
            default:         interval = '1 month';
        }

        const advanceResult = await client.query(
            `UPDATE recurring_transactions
             SET next_run_date = next_run_date + $1::INTERVAL
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [interval, parseInt(recurringId, 10), userId]
        );
        const updated = advanceResult.rows[0];

        // 4. Insert reminder notification if enabled
        if (rec.reminder_enabled) {
            const newNext    = new Date(updated.next_run_date);
            const reminderDt = new Date(newNext);
            reminderDt.setDate(reminderDt.getDate() - rec.reminder_days_before);
            if (reminderDt > new Date()) {
                const paidReminderInsert = await client.query(
                        `INSERT INTO notifications (user_id, type, title, body, scheduled_at)
                         VALUES ($1, 'recurring', $2, $3, $4)
                         RETURNING *`,
                        [
                            userId,
                            'Upcoming Recurring Transaction',
                            `Reminder: ₱${rec.amount} for ${rec.category} is due on ` +
                            `${newNext.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`,
                            reminderDt
                        ]
                    );
                    emitNotification(userId, paidReminderInsert.rows[0]);
            }
        }

        // 5. Check if this was the last occurrence
        if (updated.end_date) {
            const nextRunDate = new Date(updated.next_run_date);
            const endDate     = new Date(updated.end_date);
            if (nextRunDate > endDate) {
                await client.query(
                    `UPDATE recurring_transactions
                     SET status = 'completed', completed_at = CURRENT_DATE
                     WHERE id = $1 AND user_id = $2`,
                    [parseInt(recurringId, 10), userId]
                );
                const finalRow = await client.query(
                    `SELECT * FROM recurring_transactions WHERE id = $1`,
                    [parseInt(recurringId, 10)]
                );
                const endedInsert = await client.query(
                    `INSERT INTO notifications (user_id, type, title, body, priority)
                     VALUES ($1, 'recurring_ended', $2, $3, 'normal')
                     RETURNING *`,
                    [
                        userId,
                        '✓ Recurring Transaction Completed',
                        `Your recurring payment for ${rec.category} (₱${rec.amount}) has ended. No more automatic charges will be created.`
                    ]
                );
                emitNotification(userId, endedInsert.rows[0]);
                await client.query('COMMIT');
                return res.json({ success: true, data: finalRow.rows[0] });
            }
        }

        await client.query('COMMIT');
        return res.json({ success: true, data: updated });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[ERROR] ${new Date().toISOString()} | POST recurring/:userId/:recurringId/pay | user=${userId} | ${err.message}\n${err.stack}`);
        return res.status(500).json({ success: false, message: 'Failed to mark recurring as paid' });
    } finally {
        client.release();
    }
};

// ── POST /recurring/:userId/:recurringId/dismiss ──────────────────────────────
// Advances next_run_date ONLY — NO transaction, NO balance change.

const dismissRecurring = async (req, res) => {
    const { userId, recurringId } = req.params;
    try {
        const recResult = await pool.query(
            `SELECT * FROM recurring_transactions
             WHERE id = $1 AND user_id = $2 AND status = 'active'`,
            [parseInt(recurringId, 10), userId]
        );
        if (recResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Recurring transaction not found' });
        }
        const rec = recResult.rows[0];

        let interval;
        switch (rec.frequency) {
            case 'daily':    interval = `${rec.repeat_interval} days`;      break;
            case 'weekly':   interval = `${rec.repeat_interval * 7} days`;  break;
            case 'biweekly': interval = `${rec.repeat_interval * 14} days`; break;
            case 'monthly':  interval = `${rec.repeat_interval} months`;    break;
            case 'yearly':   interval = `${rec.repeat_interval} years`;     break;
            default:         interval = '1 month';
        }

        const result = await pool.query(
            `UPDATE recurring_transactions
             SET next_run_date = next_run_date + $1::INTERVAL
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [interval, parseInt(recurringId, 10), userId]
        );
        const updated = result.rows[0];

        // Check if this dismiss pushed next_run_date past end_date
        if (updated.end_date) {
            const nextRunDate = new Date(updated.next_run_date);
            const endDate     = new Date(updated.end_date);
            if (nextRunDate > endDate) {
                await pool.query(
                    `UPDATE recurring_transactions
                     SET status = 'completed', completed_at = CURRENT_DATE
                     WHERE id = $1 AND user_id = $2`,
                    [parseInt(recurringId, 10), userId]
                );
                const finalRow = await pool.query(
                    `SELECT * FROM recurring_transactions WHERE id = $1`,
                    [parseInt(recurringId, 10)]
                );
                return res.json({ success: true, data: finalRow.rows[0] });
            }
        }

        return res.json({ success: true, data: updated });

    } catch (err) {
        console.error(`[ERROR] ${new Date().toISOString()} | POST recurring/:userId/:recurringId/dismiss | user=${userId} | ${err.message}\n${err.stack}`);
        return res.status(500).json({ success: false, message: 'Failed to dismiss recurring transaction' });
    }
};

export { getRecurring,
    createRecurring,
    updateRecurring,
    cancelRecurring,    // ← ADD THIS
    deleteRecurring,
    processDueRecurring,
    markRecurringAsPaid,
    dismissRecurring };