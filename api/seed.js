import bcrypt from 'bcrypt';
import pool from './config/db.js';
import { BCRYPT_ROUNDS } from './constants/index.js';

export default async function seedAdmins() {
  try {
    const check = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(check.rows[0].count) > 0) {
      console.log('✅ Admins already seeded');
      return;
    }

    const mainHash  = await bcrypt.hash('MainAdmin@2026',  BCRYPT_ROUNDS);
    const staffHash = await bcrypt.hash('StaffAdmin@2026', BCRYPT_ROUNDS);

    await pool.query(`
      INSERT INTO admins (username, password, role) VALUES
        ('superadmin',    $1, 'Main Admin'),
        ('rhenz',         $2, 'Staff Admin'),
        ('jayson',        $2, 'Staff Admin'),
        ('mark',          $2, 'Staff Admin'),
        ('MaxVerstappen', $2, 'Staff Admin')
    `, [mainHash, staffHash]);
    console.log('✅ Admin accounts seeded (superadmin + 4 staff)');

    // Default global categories for web analytics
    const catCheck = await pool.query('SELECT COUNT(*) FROM categories');
    if (parseInt(catCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO categories (user_id, name, type, color_hex, icon) VALUES
          (NULL, 'Salary',     'income',  '#22C55E', 'wallet'),
          (NULL, 'Freelance',  'income',  '#3B82F6', 'briefcase'),
          (NULL, 'Business',   'income',  '#8B5CF6', 'trending-up'),
          (NULL, 'Food',       'expense', '#EF4444', 'utensils'),
          (NULL, 'Transport',  'expense', '#3B82F6', 'car'),
          (NULL, 'Bills',      'expense', '#F59E0B', 'file-text'),
          (NULL, 'Shopping',   'expense', '#EC4899', 'shopping-bag'),
          (NULL, 'Healthcare', 'expense', '#14B8A6', 'heart'),
          (NULL, 'Education',  'expense', '#6366F1', 'book'),
          (NULL, 'Recreation', 'expense', '#F97316', 'gamepad')
      `);
      console.log('✅ Default categories seeded');
    }
  } catch (err) {
    console.error('❌ Seed error:', err.message);
  }
}
