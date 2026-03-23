import pool from '../../config/db.js';
import { MESSAGES } from '../../shared/constants/messages.js';
import { isNonEmptyString } from '../../shared/validators/index.js';

let _io = null;
const setIo = (io) => { _io = io; };

// ── POST /api/admin/announcements  (admin + superadmin) ───────────────────────
const createAnnouncement = async (req, res) => {
  const { title, body, priority = 'normal' } = req.body;
  if (!isNonEmptyString(title)) return res.status(400).json({ success: false, message: 'Title is required.' });
  if (!isNonEmptyString(body))  return res.status(400).json({ success: false, message: 'Body is required.' });
  if (!['low','normal','high'].includes(priority)) {
    return res.status(400).json({ success: false, message: 'Priority must be low, normal, or high.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO announcements (title, body, priority, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [title.trim(), body.trim(), priority, req.admin?.id ?? null]
    );
    const row = result.rows[0];

    // Broadcast to all connected socket clients (prepared for WebSocket integration)
    if (_io) {
      _io.emit('announcement:new', row);
      console.log(`[Socket] Broadcast announcement:new id=${row.id}`);
    }

    return res.status(201).json({ success: true, message: MESSAGES.ANNOUNCEMENT_CREATED, data: row });
  } catch (err) {
    console.error('[Announcements] create:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANNOUNCEMENT_CREATE_FAILED });
  }
};

// ── GET /api/admin/announcements  (admin + superadmin) ────────────────────────
const listAnnouncementsAdmin = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, adm.username AS created_by_username
       FROM announcements a
       LEFT JOIN admins adm ON a.created_by = adm.admin_id
       ORDER BY a.created_at DESC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Announcements] listAdmin:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANNOUNCEMENT_FETCH_FAILED });
  }
};

// ── PUT /api/admin/announcements/:id  (admin + superadmin) ───────────────────
const updateAnnouncement = async (req, res) => {
  const { id }    = req.params;
  const { title, body, priority, is_active } = req.body;
  try {
    const check = await pool.query('SELECT id FROM announcements WHERE id=$1', [id]);
    if (!check.rowCount) return res.status(404).json({ success: false, message: MESSAGES.ANNOUNCEMENT_NOT_FOUND });

    const result = await pool.query(
      `UPDATE announcements
       SET title=COALESCE($1,title), body=COALESCE($2,body),
           priority=COALESCE($3,priority), is_active=COALESCE($4,is_active),
           updated_at=CURRENT_TIMESTAMP
       WHERE id=$5 RETURNING *`,
      [title||null, body||null, priority||null, is_active??null, id]
    );
    return res.json({ success: true, message: MESSAGES.ANNOUNCEMENT_UPDATED, data: result.rows[0] });
  } catch (err) {
    console.error('[Announcements] update:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANNOUNCEMENT_UPDATE_FAILED });
  }
};

// ── DELETE /api/admin/announcements/:id  (superadmin only) ───────────────────
const deleteAnnouncement = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM announcements WHERE id=$1 RETURNING id', [id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: MESSAGES.ANNOUNCEMENT_NOT_FOUND });
    return res.json({ success: true, message: MESSAGES.ANNOUNCEMENT_DELETED });
  } catch (err) {
    console.error('[Announcements] delete:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANNOUNCEMENT_DELETE_FAILED });
  }
};

// ── GET /api/user/announcements  (user — active only) ────────────────────────
const getUserAnnouncements = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, body, priority, created_at
       FROM announcements
       WHERE is_active = TRUE
       ORDER BY created_at DESC LIMIT 20`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Announcements] getUser:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANNOUNCEMENT_FETCH_FAILED });
  }
};

export { createAnnouncement, listAnnouncementsAdmin, updateAnnouncement,
  deleteAnnouncement, getUserAnnouncements, setIo, };