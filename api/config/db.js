import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Shared pool for the unified PESO AI server.
// Web and mobile modules both import this same instance.
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME     || 'peso_ai',
  options:  `-c timezone=Asia/Manila`,
});

pool.connect((err, client, release) => {
  if (err) { console.error('❌ DB connection FAILED:', err.message); return; }
  release();
  console.log('✅ DB connected →', process.env.DB_NAME);
});

export default pool;
