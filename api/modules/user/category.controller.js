import pool from '../../config/db.js';
import { isNonEmptyString, sanitizeString, validationError, } from '../../shared/validators/index.js';
import { MESSAGES } from '../../shared/constants/messages.js';

// Default categories seeded for every new user
const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining',     slug: 'food & dining',     icon: '🍔', color: '#FF5722' },
  { name: 'Transport',         slug: 'transport',          icon: '🚗', color: '#2196F3' },
  { name: 'Shopping',          slug: 'shopping',           icon: '🛍️', color: '#9C27B0' },
  { name: 'Bills & Utilities', slug: 'bills & utilities',  icon: '💡', color: '#FF9800' },
  { name: 'Health',            slug: 'health',             icon: '❤️', color: '#F44336' },
  { name: 'Entertainment',     slug: 'entertainment',      icon: '🎬', color: '#3F51B5' },
  { name: 'Savings',           slug: 'savings',            icon: '💰', color: '#4CAF50' },
  { name: 'Others',            slug: 'others',             icon: '📦', color: '#607D8B' },
];

// Maximum custom (non-default) categories per user
const MAX_CUSTOM_CATEGORIES = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Ensure default categories exist for a user (idempotent). */
async function ensureDefaults(userId) {
  for (const cat of DEFAULT_CATEGORIES) {
    await pool.query(
      `INSERT INTO user_categories (user_id, name, slug, icon, color, is_default)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (user_id, slug) DO NOTHING`,
      [userId, cat.name, cat.slug, cat.icon, cat.color]
    );
  }
}

// ─── GET /api/categories/:userId ─────────────────────────────────────────────

const getCategories = async (req, res) => {
  const { userId } = req.params;

  try {
    // Ensure defaults exist (handles new users seamlessly)
    await ensureDefaults(userId);

    const result = await pool.query(
      `SELECT id, name, slug, icon, color, is_default, created_at
       FROM user_categories
       WHERE user_id = $1
       ORDER BY is_default DESC, name ASC`,
      [userId]
    );

    return res.json({ success: true, categories: result.rows });
  } catch (err) {
    console.error('[Category] getCategories error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load categories.' });
  }
};

// ─── POST /api/categories/:userId ────────────────────────────────────────────

const addCategory = async (req, res) => {
  const { userId }       = req.params;
  const { name, icon, color } = req.body;

  if (!isNonEmptyString(name)) return validationError(res, 'Category name is required.');
  const slug = sanitizeString(name).toLowerCase();
  if (slug.length > 50) return validationError(res, 'Category name must be 50 characters or less.');

  try {
    // Enforce cap on custom categories
    const countResult = await pool.query(
      'SELECT COUNT(*) AS count FROM user_categories WHERE user_id = $1 AND is_default = FALSE',
      [userId]
    );
    if (parseInt(countResult.rows[0].count, 10) >= MAX_CUSTOM_CATEGORIES) {
      return res.status(400).json({
        success: false,
        message: `Maximum of ${MAX_CUSTOM_CATEGORIES} custom categories reached.`,
      });
    }

    // Check for duplicate slug
    const dupCheck = await pool.query(
      'SELECT id FROM user_categories WHERE user_id = $1 AND slug = $2',
      [userId, slug]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'A category with that name already exists.' });
    }

    const result = await pool.query(
      `INSERT INTO user_categories (user_id, name, slug, icon, color, is_default)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING id, name, slug, icon, color, is_default, created_at`,
      [
        userId,
        sanitizeString(name),
        slug,
        sanitizeString(icon)  || '📦',
        sanitizeString(color) || '#607D8B',
      ]
    );

    return res.status(201).json({ success: true, category: result.rows[0] });
  } catch (err) {
    console.error('[Category] addCategory error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to add category.' });
  }
};

// ─── PUT /api/categories/:userId/:categoryId ─────────────────────────────────

const updateCategory = async (req, res) => {
  const { userId, categoryId } = req.params;
  const { name, icon, color }  = req.body;

  if (!isNonEmptyString(name)) return validationError(res, 'Category name is required.');
  const slug = sanitizeString(name).toLowerCase();

  try {
    // Prevent editing default categories' names/slugs
    const existing = await pool.query(
      'SELECT id, is_default FROM user_categories WHERE id = $1 AND user_id = $2',
      [parseInt(categoryId, 10), userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    if (existing.rows[0].is_default) {
      // Allow icon/color edits on defaults — but not name/slug
      const result = await pool.query(
        `UPDATE user_categories
         SET icon = $1, color = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4
         RETURNING id, name, slug, icon, color, is_default`,
        [
          sanitizeString(icon)  || '📦',
          sanitizeString(color) || '#607D8B',
          parseInt(categoryId, 10),
          userId,
        ]
      );
      return res.json({ success: true, category: result.rows[0] });
    }

    // Custom category — allow full update
    const dupCheck = await pool.query(
      'SELECT id FROM user_categories WHERE user_id = $1 AND slug = $2 AND id != $3',
      [userId, slug, parseInt(categoryId, 10)]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'A category with that name already exists.' });
    }

    const result = await pool.query(
      `UPDATE user_categories
       SET name = $1, slug = $2, icon = $3, color = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6
       RETURNING id, name, slug, icon, color, is_default`,
      [
        sanitizeString(name),
        slug,
        sanitizeString(icon)  || '📦',
        sanitizeString(color) || '#607D8B',
        parseInt(categoryId, 10),
        userId,
      ]
    );

    return res.json({ success: true, category: result.rows[0] });
  } catch (err) {
    console.error('[Category] updateCategory error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update category.' });
  }
};

// ─── DELETE /api/categories/:userId/:categoryId ───────────────────────────────

const deleteCategory = async (req, res) => {
  const { userId, categoryId } = req.params;

  try {
    const existing = await pool.query(
      'SELECT id, is_default FROM user_categories WHERE id = $1 AND user_id = $2',
      [parseInt(categoryId, 10), userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    if (existing.rows[0].is_default) {
    return res.status(400).json({ success: false, message: 'Default categories cannot be deleted.' });
}

// Check if category is in use by transactions
const catRow = await pool.query(
    'SELECT name FROM user_categories WHERE id = $1 AND user_id = $2',
    [parseInt(categoryId, 10), userId]
);
if (catRow.rows.length > 0) {
    const inUse = await pool.query(
        `SELECT COUNT(*) AS count FROM transactions
         WHERE user_id = $1 AND LOWER(category) = LOWER($2)`,
        [userId, catRow.rows[0].name]
    );
    const count = parseInt(inUse.rows[0].count, 10);
    if (count > 0) {
        return res.status(409).json({
            success: false,
            message: `Cannot delete — this category is used by ${count} transaction(s).`,
            count
        });
    }
}

    await pool.query(
        'DELETE FROM user_categories WHERE id = $1 AND user_id = $2',
        [parseInt(categoryId, 10), userId]
    );

    return res.json({ success: true, message: 'Category deleted.' });
      } catch (err) {
      console.error('[Category] deleteCategory error:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to delete category.' });
    }
  };

// ─── GET /api/categories/:userId/slugs ───────────────────────────────────────
// Internal-use helper — returns only slugs for normalizeCategory() lookup

const getCategorySlugs = async (userId) => {
  const result = await pool.query(
    'SELECT slug FROM user_categories WHERE user_id = $1',
    [userId]
  );
  return result.rows.map(r => r.slug);
};

export { getCategories, addCategory, updateCategory, deleteCategory, getCategorySlugs, };