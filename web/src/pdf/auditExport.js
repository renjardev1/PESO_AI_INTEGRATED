/* ══════════════════════════════════════════════════════════════
   auditExport.js — PESO AI  v2
   Styled Excel export for Audit Trail logs
   · Wider columns — all content fully readable
   · No Formula Legend (removed per request)
   · Same colour palette & helpers as dashboardAnalyticsExport.js
══════════════════════════════════════════════════════════════ */

import { LOGO_BASE64 } from './logoBase64.js';

const loadExcelJS = () =>
  new Promise((resolve, reject) => {
    if (window.ExcelJS) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Failed to load ExcelJS'));
    document.head.appendChild(s);
  });

const triggerDownload = (buffer, filename) => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const gf = (log, ...keys) => {
  for (const k of keys) if (log[k] != null && log[k] !== '') return String(log[k]);
  return '—';
};

const fmtTs = (iso) => {
  if (!iso || iso === '—') return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso).replace('T', ' ').slice(0, 19);
    return (
      d.toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' }) +
      '  ' +
      d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
    );
  } catch { return String(iso).replace('T', ' ').slice(0, 19); }
};

const isoDate = (iso) => {
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ''; }
};

/* ── Colours ─────────────────────────────────────────────────── */
const C = {
  navy:     'FF1E3A5F', navyDark: 'FF0F172A',
  white:    'FFFFFFFF', offWhite: 'FFF8FAFC',
  slate200: 'FFE2E8F0', slate400: 'FF94A3B8', slate600: 'FF475569',
  teal:     'FF0D9488',
  green:    'FF22C55E', greenBg:  'FFF0FDF4', greenDk:  'FF15803D',
  red:      'FFEF4444', redBg:    'FFFFF5F5', redDk:    'FFB91C1C',
  amber:    'FFF59E0B', amberBg:  'FFFFFBEB', amberDk:  'FFB45309',
  blue:     'FF3B82F6', blueBg:   'FFEFF6FF', blueDk:   'FF1D4ED8',
  indigo:   'FF6366F1', indigoBg: 'FFEEF2FF', indigoDk: 'FF4338CA',
  purple:   'FF7E22CE', purpleBg: 'FFFDF4FF',
  orange:   'FFC2410C', orangeBg: 'FFFFF7ED',
  slate:    'FF64748B', slateBg:  'FFF8FAFC',
};

const solid = (a)  => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: a } });
const thin  = (a = C.slate200) => ({
  top:    { style: 'thin', color: { argb: a } },
  bottom: { style: 'thin', color: { argb: a } },
  left:   { style: 'thin', color: { argb: a } },
  right:  { style: 'thin', color: { argb: a } },
});
const btm = (a = C.slate200) => ({ bottom: { style: 'thin', color: { argb: a } } });

const sc = (cell, { bg, fg = C.navyDark, bold = false, size = 10, align = 'left', valign = 'middle', wrap = false, italic = false } = {}) => {
  if (bg) cell.fill = solid(bg);
  cell.font      = { name: 'Calibri', size, bold, italic, color: { argb: fg } };
  cell.alignment = { horizontal: align, vertical: valign, wrapText: wrap };
};

const addLogo = (ws, wb) => {
  try {
    const clean = LOGO_BASE64.replace(/^data:image\/\w+;base64,/, '');
    ws.addImage(wb.addImage({ base64: clean, extension: 'png' }),
      { tl: { col: 0.4, row: 0.7 }, ext: { width: 90, height: 90 }, editAs: 'oneCell' });
  } catch (e) { console.warn('Logo skip:', e.message); }
};

const buildHeader = (ws, wb, COLS, title, sub, dateStr, timeStr) => {
  for (let r = 1; r <= 5; r++) {
    ws.getRow(r).height = 22;
    for (let c = 1; c <= COLS; c++) ws.getCell(r, c).fill = solid(C.navy);
  }
  addLogo(ws, wb);
  ws.mergeCells(2, 3, 2, COLS - 1);
  ws.getCell(2, 3).value = title;
  sc(ws.getCell(2, 3), { fg: C.white, bold: true, size: 18, align: 'center' });
  ws.mergeCells(3, 3, 3, COLS - 1);
  ws.getCell(3, 3).value = sub;
  sc(ws.getCell(3, 3), { fg: C.white, size: 10, align: 'center' });
  ws.getCell(2, COLS).value = dateStr;
  sc(ws.getCell(2, COLS), { fg: C.white, size: 9, align: 'right', bold: true });
  ws.getCell(3, COLS).value = timeStr;
  sc(ws.getCell(3, COLS), { fg: C.white, size: 9, align: 'right' });
};

const sectionRow = (ws, row, c1, c2, label, bg = C.navyDark) => {
  ws.mergeCells(row, c1, row, c2);
  ws.getRow(row).height = 26;
  ws.getCell(row, c1).value = label;
  sc(ws.getCell(row, c1), { bg, fg: C.white, bold: true, size: 11 });
};

const tableHeader = (ws, row, labels) => {
  ws.getRow(row).height = 30;
  labels.forEach((lbl, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = lbl; cell.border = thin();
    sc(cell, { bg: C.navyDark, fg: C.white, bold: true, size: 10, align: 'center' });
  });
};

const statCard = (ws, vRow, lRow, c1, c2, value, label, bg) => {
  ws.mergeCells(vRow, c1, vRow, c2);
  ws.getCell(vRow, c1).value = value;
  sc(ws.getCell(vRow, c1), { bg, fg: C.white, bold: true, size: 22, align: 'center' });
  ws.mergeCells(lRow, c1, lRow, c2);
  ws.getCell(lRow, c1).value = label;
  sc(ws.getCell(lRow, c1), { bg, fg: C.white, size: 9, align: 'center' });
};

const footer = (ws, row, COLS, dateStr, timeStr) => {
  ws.mergeCells(row, 1, row, COLS);
  ws.getRow(row).height = 18;
  ws.getCell(row, 1).value = `PESO AI  ·  Audit Trail Export  ·  ${dateStr} ${timeStr}  ·  Confidential`;
  sc(ws.getCell(row, 1), { fg: C.slate400, size: 9, align: 'center', italic: true });
};

const actionColor = (action = '') => {
  const a = action.toLowerCase();
  if (/^login/.test(a))                       return { fg: C.blueDk,  bg: C.blueBg   };
  if (/^logout/.test(a))                      return { fg: C.slate,   bg: C.slateBg  };
  if (/(creat|add)/.test(a))                  return { fg: C.greenDk, bg: C.greenBg  };
  if (/(delet|remov|clear)/.test(a))          return { fg: C.redDk,   bg: C.redBg    };
  if (/(password|pw)/.test(a))                return { fg: C.orange,  bg: C.orangeBg };
  if (/(avatar|picture|photo|image)/.test(a)) return { fg: C.purple,  bg: C.purpleBg };
  if (/(display.?name|name|profile)/.test(a)) return { fg: C.greenDk, bg: C.greenBg  };
  if (/(edit|updat|chang)/.test(a))           return { fg: C.amberDk, bg: C.amberBg  };
  return                                             { fg: C.slate,   bg: C.slateBg  };
};

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════ */
export const generateAuditXLSX = async (logs = [], options = {}) => {
  await loadExcelJS();

  const now      = new Date();
  const dateStr  = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr  = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const todayISO = now.toISOString().slice(0, 10);

  const { filter = 'all' } = options;
  const filtered = filter === 'today'
    ? logs.filter(l => isoDate(gf(l, 'created_at', 'time', 'timestamp')) === todayISO)
    : filter !== 'all'
    ? logs.filter(l => gf(l, 'action').toLowerCase().includes(filter.toLowerCase()))
    : logs;

  /* ── KPIs ─────────────────────────────────────────────────── */
  const todayCount = logs.filter(l => isoDate(gf(l, 'created_at', 'time', 'timestamp')) === todayISO).length;
  const deletions  = logs.filter(l => /delet|remov/i.test(gf(l, 'action'))).length;
  const logins     = logs.filter(l => /^login/i.test(gf(l, 'action'))).length;
  const logouts    = logs.filter(l => /^logout/i.test(gf(l, 'action'))).length;
  const creates    = logs.filter(l => /creat|add/i.test(gf(l, 'action'))).length;
  const updates    = logs.filter(l => /updat|edit|chang/i.test(gf(l, 'action'))).length;

  const adminCounts = {};
  logs.forEach(l => {
    const a = gf(l, 'admin_name', 'admin', 'user');
    adminCounts[a] = (adminCounts[a] || 0) + 1;
  });
  const [[topAdmin = '—', topCount = 0] = []] =
    Object.entries(adminCounts).sort((a, b) => b[1] - a[1]);

  const filterLabel = filter === 'all' ? 'All Records'
    : filter === 'today' ? "Today's Activity"
    : filter;

  const wb = new window.ExcelJS.Workbook();
  wb.creator = 'PESO AI'; wb.created = now; wb.modified = now;

  /* ════════════════════════════════════════════════════════════
     SHEET 1 — AUDIT SUMMARY
  ════════════════════════════════════════════════════════════ */
  const ws1 = wb.addWorksheet('Audit Summary', { views: [{ showGridLines: false }] });
  const C1  = 8;
  ws1.columns = [
    { width: 32 },  // Metric
    { width: 20 },  // Value
    { width: 18 },  // spacer cols
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 38 },  // Description
  ];

  buildHeader(ws1, wb, C1,
    'AUDIT TRAIL REPORT',
    `Admin Activity Log  ·  ${filtered.length} entries  ·  Filter: ${filterLabel}  ·  ${dateStr}`,
    dateStr, timeStr,
  );

  ws1.getRow(7).height = 40; ws1.getRow(8).height = 20; ws1.getRow(9).height = 8;
  statCard(ws1, 7, 8, 1, 2, logs.length,    'TOTAL LOGS',        C.indigo);
  statCard(ws1, 7, 8, 3, 4, todayCount,     'ACTIONS TODAY',     C.teal);
  statCard(ws1, 7, 8, 5, 6, deletions,      'DELETIONS',         C.red);
  statCard(ws1, 7, 8, 7, 8, logins,         'LOGINS',            C.green);

  ws1.getRow(10).height = 40; ws1.getRow(11).height = 20; ws1.getRow(12).height = 8;
  statCard(ws1, 10, 11, 1, 2, logouts,      'LOGOUTS',           C.slate);
  statCard(ws1, 10, 11, 3, 4, creates,      'CREATED',           C.greenDk);
  statCard(ws1, 10, 11, 5, 6, updates,      'UPDATES/CHANGES',   C.amberDk);
  statCard(ws1, 10, 11, 7, 8, `${topAdmin} (${topCount}x)`, 'MOST ACTIVE ADMIN', C.navy);

  /* ── KPI Table ───────────────────────────────────────────────  */
  sectionRow(ws1, 13, 1, C1, '  KPI SUMMARY');
  tableHeader(ws1, 14, ['Metric', 'Count', 'Filter Applied', '', '', '', '', 'Description']);
  ws1.mergeCells(14, 3, 14, 7);
  sc(ws1.getCell(14, 3), { bg: C.navyDark, fg: C.white, bold: true, size: 10, align: 'center' });

  const kpiRows = [
    { m: 'Total Logs',        v: logs.length,           note: 'All records in the audit trail',               desc: 'Every admin action captured by the system',            fg: C.indigo  },
    { m: 'Actions Today',     v: todayCount,            note: `Date = ${todayISO}`,                           desc: "Entries where timestamp matches today's date",         fg: C.teal    },
    { m: 'Deletions',         v: deletions,             note: 'action contains "delet" or "remov"',           desc: 'Security-sensitive — review these immediately',        fg: C.redDk   },
    { m: 'Logins',            v: logins,                note: 'action starts with "login"',                   desc: 'Successful admin login events',                        fg: C.greenDk },
    { m: 'Logouts',           v: logouts,               note: 'action starts with "logout"',                  desc: 'Admin session end events',                             fg: C.slate   },
    { m: 'Created',           v: creates,               note: 'action contains "creat" or "add"',             desc: 'New admin accounts or records created',                fg: C.greenDk },
    { m: 'Updates / Changes', v: updates,               note: 'action contains "updat", "edit" or "chang"',   desc: 'Profile, name, password, avatar changes',              fg: C.amberDk },
    { m: 'Filtered Entries',  v: filtered.length,       note: `Filter: ${filterLabel}`,                       desc: 'Rows visible in the Audit Log sheet',                  fg: C.navy    },
    { m: 'Most Active Admin', v: topAdmin,              note: `${topCount} action${topCount !== 1 ? 's' : ''}`, desc: 'Admin with the highest number of logged actions',    fg: C.indigoDk},
    { m: 'Export Generated',  v: `${dateStr} ${timeStr}`, note: 'Export timestamp',                           desc: 'Date and time this file was created',                  fg: C.slate   },
  ];

  kpiRows.forEach(({ m, v, note, desc, fg }, idx) => {
    const r     = 15 + idx;
    const rowBg = idx % 2 === 0 ? C.white : C.offWhite;
    ws1.getRow(r).height = 24;

    ws1.getCell(r, 1).value = m;    ws1.getCell(r, 1).border = btm();
    sc(ws1.getCell(r, 1), { bg: rowBg, fg: C.navyDark, bold: true, size: 10 });

    ws1.getCell(r, 2).value = v;    ws1.getCell(r, 2).border = btm();
    sc(ws1.getCell(r, 2), { bg: rowBg, fg, bold: true, size: 11, align: 'center' });

    ws1.mergeCells(r, 3, r, 7);
    ws1.getCell(r, 3).value = note; ws1.getCell(r, 3).border = btm();
    sc(ws1.getCell(r, 3), { bg: rowBg, fg: C.teal, size: 10, italic: true });

    ws1.getCell(r, 8).value = desc; ws1.getCell(r, 8).border = btm();
    sc(ws1.getCell(r, 8), { bg: rowBg, fg: C.slate600, size: 10 });
  });

  footer(ws1, 15 + kpiRows.length + 2, C1, dateStr, timeStr);

  /* ════════════════════════════════════════════════════════════
     SHEET 2 — AUDIT LOG (full table, wide columns)
  ════════════════════════════════════════════════════════════ */
  const ws2 = wb.addWorksheet('Audit Log', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 9 }],
  });
  const C2 = 6;
  ws2.columns = [
    { width: 6  },   // # (row number)
    { width: 30 },   // Admin
    { width: 18 },   // Role
    { width: 42 },   // Action  ← widest — long action texts
    { width: 26 },   // Readable Timestamp
    { width: 12 },   // Day of week
  ];

  buildHeader(ws2, wb, C2,
    'AUDIT LOG — FULL TABLE',
    `Filter: ${filterLabel}  ·  ${filtered.length} record${filtered.length !== 1 ? 's' : ''}`,
    dateStr, timeStr,
  );

  sectionRow(ws2, 7, 1, C2,
    `  AUDIT LOG  ·  ${filtered.length} record${filtered.length !== 1 ? 's' : ''}  ·  Filter: ${filterLabel}`);

  tableHeader(ws2, 8, ['#', 'Admin (User)', 'Role', 'Action', 'Timestamp', 'Day']);

  filtered.forEach((log, idx) => {
    const r      = 9 + idx;
    const rowBg  = idx % 2 === 0 ? C.white : C.offWhite;
    const action = gf(log, 'action');
    const ts     = gf(log, 'created_at', 'time', 'timestamp');
    const admin  = gf(log, 'admin_name', 'admin', 'user');
    const role   = gf(log, 'admin_role', 'role');
    const { fg: aFg, bg: aBg } = actionColor(action);

    ws2.getRow(r).height = 22;

    // # — row number
    ws2.getCell(r, 1).value = idx + 1;
    ws2.getCell(r, 1).border = btm();
    sc(ws2.getCell(r, 1), { bg: rowBg, fg: C.slate400, size: 9, align: 'center' });

    // Admin
    ws2.getCell(r, 2).value = admin;
    ws2.getCell(r, 2).border = btm();
    sc(ws2.getCell(r, 2), { bg: rowBg, fg: C.navyDark, bold: true, size: 10 });

    // Role
    const roleFg = /main/i.test(role) ? C.indigoDk : C.slate;
    const roleBg = /main/i.test(role) ? C.indigoBg : C.offWhite;
    ws2.getCell(r, 3).value = role;
    ws2.getCell(r, 3).border = btm();
    sc(ws2.getCell(r, 3), { bg: roleBg, fg: roleFg, bold: true, size: 9, align: 'center' });

    // Action — colour-coded, full text, no truncation
    ws2.getCell(r, 4).value = action;
    ws2.getCell(r, 4).border = btm();
    sc(ws2.getCell(r, 4), { bg: aBg, fg: aFg, bold: true, size: 9 });

    // Readable timestamp
    ws2.getCell(r, 5).value = fmtTs(ts);
    ws2.getCell(r, 5).border = btm();
    sc(ws2.getCell(r, 5), { bg: rowBg, fg: C.navyDark, size: 9 });

    // Day of week
    try {
      const d = new Date(ts);
      ws2.getCell(r, 6).value = isNaN(d) ? '—' : d.toLocaleDateString('en-PH', { weekday: 'short' });
    } catch { ws2.getCell(r, 6).value = '—'; }
    ws2.getCell(r, 6).border = btm();
    sc(ws2.getCell(r, 6), { bg: rowBg, fg: C.slate400, size: 9, align: 'center' });
  });

  /* ── Action colour legend (compact, just 1 row) ──────────────  */
  const legendRow = 9 + filtered.length + 1;
  ws2.getRow(legendRow).height = 10;
  sectionRow(ws2, legendRow + 1, 1, C2, '  ACTION COLOUR LEGEND', C.teal);
  ws2.getRow(legendRow + 2).height = 22;
  [
    { label: '→ Login',          fg: C.blueDk,  bg: C.blueBg   },
    { label: '→ Logout',         fg: C.slate,   bg: C.slateBg  },
    { label: '→ Created',        fg: C.greenDk, bg: C.greenBg  },
    { label: '→ Deleted',        fg: C.redDk,   bg: C.redBg    },
    { label: '→ Updated/Changed',fg: C.amberDk, bg: C.amberBg  },
    { label: '→ Password/Avatar',fg: C.orange,  bg: C.orangeBg },
  ].forEach(({ label, fg, bg }, i) => {
    if (i + 1 > C2) return;
    const cell = ws2.getCell(legendRow + 2, i + 1);
    cell.value = label; cell.border = thin(C.teal);
    sc(cell, { bg, fg, bold: true, size: 9, align: 'center' });
  });

  footer(ws2, legendRow + 4, C2, dateStr, timeStr);

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(buffer, `PESO_Audit_Trail_${now.toISOString().slice(0, 10)}.xlsx`);
};