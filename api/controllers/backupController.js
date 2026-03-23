import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import pool from '../config/db.js';
import { BACKUP_ENCRYPTION_KEY, DB_CONFIG, NODE_ENV } from '../config/index.js';
import { HTTP, ROLES } from '../constants/index.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const API_DIR    = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(API_DIR, 'backups');
const BACKUP_FILENAME_PREFIX = 'peso_ai_backup_';
const ENCRYPTION_ALGO = 'aes-256-gcm';
const WINDOWS_TOOL_VERSIONS = ['17','16','15','14','13','12'];
const backupKey = crypto.createHash('sha256').update(String(BACKUP_ENCRYPTION_KEY||'')).digest();

const TABLE_RESTORE_ORDER = [
  'admins','users','categories','admin_refresh_tokens','budgets','transactions',
  'chat_history','savings_goals','notifications','system_logs','admin_logs',
];

const formatBytes = (bytes=0) => {
  const v = Number(bytes)||0;
  if (v>=1073741824) return `${(v/1073741824).toFixed(2)} GB`;
  if (v>=1048576)    return `${(v/1048576).toFixed(2)} MB`;
  if (v>=1024)       return `${(v/1024).toFixed(2)} KB`;
  return `${v} B`;
};

const padTimePart = (v) => String(v).padStart(2,'0');

const createBackupTimestamp = (d=new Date()) =>
  `${d.getFullYear()}-${padTimePart(d.getMonth()+1)}-${padTimePart(d.getDate())}_${padTimePart(d.getHours())}-${padTimePart(d.getMinutes())}`;

const isMainAdmin = (req) =>
  req.admin?.role === ROLES.MAIN_ADMIN || req.admin?.role === 'Super Admin';

const ensureMainAdmin = (req, res) => {
  if (isMainAdmin(req)) return true;
  sendError(res, HTTP.FORBIDDEN, 'Forbidden: Main Admin access required');
  return false;
};

const ensureBackupDir = async () => { await fs.mkdir(BACKUP_DIR, { recursive: true }); };

const safeAudit = async (adminId, action) => {
  try { await pool.query('INSERT INTO admin_logs (admin_id, action, target_type) VALUES ($1,$2,$3)', [adminId, action, 'backup']); } catch {}
};

const safeSystemLog = async (type, userName, message) => {
  try { await pool.query('INSERT INTO system_logs (type, timestamp, user_name, message) VALUES ($1,NOW(),$2,$3)', [type, userName, message]); } catch {}
};

const encryptBackupPayload = (payload) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, backupKey, iv);
  const encrypted = Buffer.concat([cipher.update(payload,'utf8'), cipher.final()]);
  return JSON.stringify({ kind:'pesoai-encrypted-backup', version:2, algorithm:ENCRYPTION_ALGO,
    createdAt:new Date().toISOString(), iv:iv.toString('base64'),
    tag:cipher.getAuthTag().toString('base64'), data:encrypted.toString('base64') }, null, 2);
};

const decryptBackupPayload = (content) => {
  const parsed = JSON.parse(content);
  if (parsed?.kind !== 'pesoai-encrypted-backup') return content;
  const decipher = crypto.createDecipheriv(parsed.algorithm||ENCRYPTION_ALGO, backupKey, Buffer.from(parsed.iv,'base64'));
  decipher.setAuthTag(Buffer.from(parsed.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parsed.data,'base64')), decipher.final()]).toString('utf8');
};

const buildDbArgs = () => {
  if (DB_CONFIG.connectionString) return [];
  const args = [];
  if (DB_CONFIG.host)     args.push('--host',     String(DB_CONFIG.host));
  if (DB_CONFIG.port)     args.push('--port',     String(DB_CONFIG.port));
  if (DB_CONFIG.user)     args.push('--username', String(DB_CONFIG.user));
  if (DB_CONFIG.database) args.push(String(DB_CONFIG.database));
  return args;
};

const buildToolEnv = () => {
  const env = { ...process.env };
  if (DB_CONFIG.connectionString) env.DATABASE_URL = DB_CONFIG.connectionString;
  else if (DB_CONFIG.password) env.PGPASSWORD = String(DB_CONFIG.password);
  return env;
};

const escapeIdentifier = (v) => `"${String(v).replace(/"/g,'""')}"`;

const toolCandidates = (toolName) => {
  if (process.platform !== 'win32') return [toolName];
  const names = [`${toolName}.exe`, toolName];
  const candidates = [...names];
  const roots = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean);
  for (const root of roots)
    for (const ver of WINDOWS_TOOL_VERSIONS)
      candidates.push(path.join(root,'PostgreSQL',ver,'bin',`${toolName}.exe`));
  return candidates;
};

const runTool = async (toolName, args) => {
  const env = buildToolEnv();
  const candidates = toolCandidates(toolName);
  let lastError = null;
  for (const command of candidates) {
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(command, args, { env, stdio:['ignore','pipe','pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) { resolve(); return; }
          reject(new Error(stderr.trim() || `${toolName} exited with code ${code}`));
        });
      });
      return;
    } catch (error) {
      lastError = error;
      const missing = error?.code==='ENOENT' || /not recognized|not found/i.test(String(error?.message||''));
      if (missing) continue;
      throw error;
    }
  }
  throw new Error(`${toolName} is not available. Install PostgreSQL command-line tools or add them to PATH.`);
};

const getPublicTables = async (client=pool) => {
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name ASC`);
  return result.rows.map(r=>r.table_name).filter(n=>!['spatial_ref_sys'].includes(n));
};

const getTableColumns = async (tableName, client=pool) => {
  const result = await client.query(`
    SELECT column_name, data_type, udt_name, is_identity
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position ASC`, [tableName]);
  return result.rows;
};

const exportJsonBackup = async (filePath) => {
  const tables = await getPublicTables();
  const snapshot = { kind:'pesoai-json-backup', version:1, createdAt:new Date().toISOString(),
    database: DB_CONFIG.database||null, tables:{} };
  for (const tableName of tables) {
    const columns = await getTableColumns(tableName);
    const rows    = await pool.query(`SELECT * FROM ${escapeIdentifier(tableName)}`);
    snapshot.tables[tableName] = {
      columns: columns.map(c=>({ name:c.column_name, dataType:c.data_type, udtName:c.udt_name, isIdentity:c.is_identity==='YES' })),
      rows: rows.rows,
    };
  }
  await fs.writeFile(filePath, encryptBackupPayload(JSON.stringify(snapshot)), 'utf8');
};

const parseTimestamp = (v) => { if (!v) return null; const p=new Date(v); return isNaN(p.getTime())?null:p.toISOString(); };

const toEntry = async (absolutePath, source='generated') => {
  const stats = await fs.stat(absolutePath);
  return { filename:path.basename(absolutePath), source, size:stats.size, sizeLabel:formatBytes(stats.size),
    createdAt:stats.birthtime.toISOString(), updatedAt:stats.mtime.toISOString() };
};

const toCatalogEntryFromJson = async (absolutePath, source='generated') => {
  const base = await toEntry(absolutePath, source);
  try {
    const raw = await fs.readFile(absolutePath,'utf8');
    const parsed = JSON.parse(decryptBackupPayload(raw));
    if (parsed?.kind==='pesoai-json-backup')
      return { ...base, engine:'json', encrypted:true, createdAt:parseTimestamp(parsed.createdAt)||base.createdAt };
  } catch {}
  return { ...base, engine:'custom' };
};

const restoreJsonBackupContent = async (rawContent) => {
  const parsed = JSON.parse(decryptBackupPayload(rawContent));
  if (parsed?.kind!=='pesoai-json-backup'||typeof parsed.tables!=='object')
    throw new Error('Invalid JSON backup file');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const allTables = Object.keys(parsed.tables);
    const orderedTables = [
      ...TABLE_RESTORE_ORDER.filter(t=>allTables.includes(t)),
      ...allTables.filter(t=>!TABLE_RESTORE_ORDER.includes(t)),
    ];
    if (orderedTables.length>0)
      await client.query(`TRUNCATE TABLE ${orderedTables.map(t=>`"public".${escapeIdentifier(t)}`).join(',')} RESTART IDENTITY CASCADE`);
    for (const tableName of orderedTables) {
      const table   = parsed.tables[tableName]||{};
      const columns = Array.isArray(table.columns)?table.columns:[];
      const rows    = Array.isArray(table.rows)?table.rows:[];
      if (!rows.length||!columns.length) continue;
      const colNames = columns.map(c=>c.name);
      const colSql   = colNames.map(escapeIdentifier).join(', ');
      for (const row of rows) {
        const ph = colNames.map((_,i)=>`$${i+1}`).join(', ');
        await client.query(`INSERT INTO ${escapeIdentifier(tableName)} (${colSql}) VALUES (${ph})`,
          colNames.map(n=>row[n]));
      }
      for (const col of columns) {
        if (col.isIdentity) continue;
        const seqResult = await client.query('SELECT pg_get_serial_sequence($1,$2) AS seq',
          [`public.${tableName}`, col.name]);
        const seqName = seqResult.rows[0]?.seq;
        if (!seqName) continue;
        await client.query(`SELECT setval($1,COALESCE((SELECT MAX(${escapeIdentifier(col.name)}) FROM ${escapeIdentifier(tableName)}),0),true)`, [seqName]);
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

const getCatalog = async () => {
  await ensureBackupDir();
  const entries = [];
  try {
    const names = await fs.readdir(BACKUP_DIR);
    for (const name of names) {
      const ap = path.join(BACKUP_DIR,name);
      const stats = await fs.stat(ap);
      if (!stats.isFile()) continue;
      entries.push(name.toLowerCase().endsWith('.json')
        ? await toCatalogEntryFromJson(ap,'generated')
        : await toEntry(ap,'generated'));
    }
  } catch {}
  return entries.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
};

const resolveCatalogFile = async (filename) => {
  const catalog = await getCatalog();
  const entry   = catalog.find(e=>e.filename===filename);
  if (!entry) return null;
  return { ...entry, absolutePath: path.join(BACKUP_DIR, entry.filename) };
};

export const listBackups = async (req, res) => {
  if (!ensureMainAdmin(req, res)) return;
  try {
    const backups = await getCatalog();
    return sendSuccess(res, { backups, backupDirectory:BACKUP_DIR, database:DB_CONFIG.database||'database',
      mode:DB_CONFIG.connectionString?'connection-string':NODE_ENV, lastBackupAt:backups[0]?.updatedAt||null }, 'Backups retrieved');
  } catch (error) { return sendError(res, HTTP.INTERNAL, 'Unable to list backups'); }
};

export const createBackup = async (req, res) => {
  if (!ensureMainAdmin(req, res)) return;
  try {
    await ensureBackupDir();
    const stamp    = createBackupTimestamp();
    const filename = `${BACKUP_FILENAME_PREFIX}${stamp}.dump`;
    const filePath = path.join(BACKUP_DIR, filename);
    let entry; let createdFilename = filename; let engine = 'pg_dump';
    try {
      await runTool('pg_dump', ['--format=custom','--no-owner','--no-privileges','--file',filePath,...buildDbArgs()]);
      entry = await toEntry(filePath,'generated');
    } catch (error) {
      if (!/not available/i.test(String(error.message||''))) throw error;
      createdFilename = `${BACKUP_FILENAME_PREFIX}${stamp}.json`;
      const jsonPath  = path.join(BACKUP_DIR, createdFilename);
      await exportJsonBackup(jsonPath);
      entry  = await toCatalogEntryFromJson(jsonPath,'generated');
      engine = 'json';
    }
    await safeAudit(req.admin.id, `Created database backup: ${createdFilename}`);
    await safeSystemLog('SYSTEM', req.admin.name, `Database backup created: ${createdFilename}`);
    return sendSuccess(res, { backup:{...entry, engine, encrypted:engine==='json'} },
      engine==='json'?'Backup created using built-in JSON export':'Backup created successfully');
  } catch (error) { return sendError(res, HTTP.INTERNAL, error.message||'Unable to create backup'); }
};

export const downloadBackup = async (req, res) => {
  if (!ensureMainAdmin(req, res)) return;
  try {
    const record = await resolveCatalogFile(req.params.filename);
    if (!record) return sendError(res, HTTP.NOT_FOUND, 'Backup file not found');
    return res.download(record.absolutePath, record.filename);
  } catch (error) { return sendError(res, HTTP.INTERNAL, 'Unable to download backup'); }
};

export const restoreBackup = async (req, res) => {
  if (!ensureMainAdmin(req, res)) return;
  const { filename, uploadedFile } = req.body||{};
  try {
    if (uploadedFile?.content) {
      await restoreJsonBackupContent(uploadedFile.content);
      await safeAudit(req.admin.id, `Restored database from uploaded backup: ${uploadedFile.name||'uploaded file'}`);
      await safeSystemLog('SYSTEM', req.admin.name, `Database restored from uploaded backup: ${uploadedFile.name||'uploaded file'}`);
      return sendSuccess(res, { restoredFrom:uploadedFile.name||'uploaded-file', source:'upload' }, 'Database restored from uploaded backup');
    }
    const record = await resolveCatalogFile(filename);
    if (!record) return sendError(res, HTTP.NOT_FOUND, 'Backup file not found');
    if (record.filename.toLowerCase().endsWith('.json')) {
      await (async () => { const raw = await fs.readFile(record.absolutePath,'utf8'); await restoreJsonBackupContent(raw); })();
    } else {
      const args = ['--clean','--if-exists','--no-owner','--no-privileges',
        '--dbname', DB_CONFIG.connectionString||DB_CONFIG.database];
      if (!DB_CONFIG.connectionString) {
        if (DB_CONFIG.host) args.push('--host',String(DB_CONFIG.host));
        if (DB_CONFIG.port) args.push('--port',String(DB_CONFIG.port));
        if (DB_CONFIG.user) args.push('--username',String(DB_CONFIG.user));
      }
      args.push(record.absolutePath);
      await runTool('pg_restore', args);
    }
    await safeAudit(req.admin.id, `Restored database from backup: ${record.filename}`);
    await safeSystemLog('SYSTEM', req.admin.name, `Database restored from backup: ${record.filename}`);
    return sendSuccess(res, { restoredFrom:record.filename, source:record.source }, `Database restored from ${record.filename}`);
  } catch (error) { return sendError(res, HTTP.INTERNAL, error.message||'Unable to restore backup'); }
};
