/* ══════════════════════════════════════════════════════════════
   usersExport.js — PESO AI | FINAL FIXED HEADER
   - Fixed: Visible "USER MANAGEMENT REPORT"
   - Logo, Title, and Date/Time properly separated
   - Proportional Logo (1:1)
══════════════════════════════════════════════════════════════ */

import { LOGO_BASE64 } from './logoBase64.js';

const loadExcelJS = () =>
  new Promise((resolve, reject) => {
    if (window.ExcelJS) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ExcelJS'));
    document.head.appendChild(s);
  });

const triggerDownload = (buffer, filename) => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const fullName = u => [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
const fmtDate = d => !d ? 'N/A' : new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateTime = d => !d ? 'N/A' : new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

export const generateUsersXLSX = async (users, filters) => {
  await loadExcelJS();

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const active = users.filter(u => u.onboarding_completed === true).length;
  const inactive = users.filter(u => u.onboarding_completed !== true).length;
  const actRate = users.length ? Math.round((active / users.length) * 100) : 0;

  const C = {
    navy: 'FF1E3A5F',
    navyDark: 'FF0F172A',
    accent: 'FF3B82F6',
    white: 'FFFFFFFF',
    offWhite: 'FFF8FAFC',
    slate200: 'FFE2E8F0',
    slate400: 'FF94A3B8',
    green: 'FF10B981',
    red: 'FFEF4444',
    amber: 'FFF59E0B',
    activeBg: 'FFDCFCE7',
    activeFg: 'FF166534',
    inactiveBg: 'FFFEE2E2',
    inactiveFg: 'FF991B1B',
  };

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('User Management', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 11 }],
  });

  ws.columns = [
    { key: 'no', width: 8 },
    { key: 'id', width: 20 },
    { key: 'name', width: 35 },
    { key: 'email', width: 35 },
    { key: 'location', width: 30 },
    { key: 'role', width: 15 },
    { key: 'status', width: 15 },
    { key: 'joined', width: 20 },
    { key: 'lastActive', width: 25 },
  ];

  const COLS = ws.columns.length;
  const gc = (r, c) => ws.getCell(r, c);
  const grh = (r, h) => (ws.getRow(r).height = h);
  const sp = (r, c1, c2) => { if (c1 <= c2) ws.mergeCells(r, c1, r, c2); };
  
  const st = (r, c, { fill: f, fg = 'FF334155', bold = false, size = 11, align = 'left' } = {}) => {
    const cl = gc(r, c);
    if (f) cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: f } };
    cl.font = { name: 'Segoe UI', size, bold, color: { argb: fg } };
    cl.alignment = { horizontal: align, vertical: 'middle' };
  };

  // --- 1. HEADER BLOCK (Rows 1-5) ---
  for (let r = 1; r <= 5; r++) {
    grh(r, 22);
    for (let c = 1; c <= COLS; c++) {
      gc(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } };
    }
  }

  // LOGO (Inilagay sa bandang kaliwa pero hindi sakop ang gitna)
  try {
    const cleanBase64 = LOGO_BASE64.replace(/^data:image\/\w+;base64,/, "");
    const imageId = wb.addImage({ base64: cleanBase64, extension: 'png' });
    ws.addImage(imageId, {
      tl: { col: 0.5, row: 0.8 }, 
      ext: { width: 95, height: 95 },
      editAs: 'oneCell'
    });
  } catch (e) { console.warn('Logo error:', e.message); }

  // CENTERED TITLES (Columns 3 to 7 ang ginamit para hindi ma-overlap ang logo at date)
  sp(2, 3, 7); 
  gc(2, 3).value = 'USER MANAGEMENT REPORT';
  st(2, 3, { fg: C.white, bold: true, size: 22, align: 'center' });

  sp(3, 3, 7);
  gc(3, 3).value = `System Records as of ${dateStr}`;
  st(3, 3, { fg: C.white, size: 11, align: 'center' });

  // DATE & TIME (Far Right)
  gc(2, COLS).value = dateStr;
  st(2, COLS, { fg: C.white, size: 10, align: 'right', bold: true });
  gc(3, COLS).value = timeStr;
  st(3, COLS, { fg: C.white, size: 10, align: 'right' });

  // --- 2. STATS SECTION ---
  grh(7, 35); grh(8, 20);
  const stats = [
    { label: 'TOTAL USERS', value: users.length, fill: C.accent, c1: 1, c2: 2 },
    { label: 'ACTIVE', value: active, fill: C.green, c1: 3, c2: 4 },
    { label: 'INACTIVE', value: inactive, fill: C.red, c1: 5, c2: 6 },
    { label: 'ACTIVE RATE', value: `${actRate}%`, fill: C.amber, c1: 7, c2: 9 },
  ];

  stats.forEach(s => {
    sp(7, s.c1, s.c2);
    gc(7, s.c1).value = s.value;
    st(7, s.c1, { fill: s.fill, fg: C.white, bold: true, size: 24, align: 'center' });
    sp(8, s.c1, s.c2);
    gc(8, s.c1).value = s.label;
    st(8, s.c1, { fill: s.fill, fg: C.white, size: 9, align: 'center' });
  });

  // --- 3. TABLE HEADER ---
  const HDR = 10;
  grh(HDR, 30);
  const headers = ['#', 'User ID', 'Full Name', 'Email Address', 'Location', 'Role', 'Status', 'Date Joined', 'Last Activity'];
  headers.forEach((h, i) => {
    const cl = gc(HDR, i + 1);
    cl.value = h;
    st(HDR, i + 1, { fill: C.navyDark, fg: C.white, bold: true, size: 11, align: 'center' });
  });

  // --- 4. DATA ROWS ---
  users.forEach((u, idx) => {
    const r = HDR + 1 + idx;
    grh(r, 26);
    const isAct = u.onboarding_completed === true;

    const rowData = [
      idx + 1,
      u.id?.substring(0, 8).toUpperCase() ?? '—',
      fullName(u).toUpperCase(),
      u.email ?? '—',
      u.location || 'NOT SET',
      (u.role || 'USER').toUpperCase(),
      isAct ? 'ACTIVE' : 'INACTIVE',
      fmtDate(u.created_at),
      fmtDateTime(u.last_active_at)
    ];

    rowData.forEach((v, ci) => {
      const cl = gc(r, ci + 1);
      cl.value = v;
      const rowFill = idx % 2 === 0 ? C.white : C.offWhite;
      
      if (ci === 6) { // Status column
        st(r, ci + 1, { fill: isAct ? C.activeBg : C.inactiveBg, fg: isAct ? C.activeFg : C.inactiveFg, bold: true, size: 9, align: 'center' });
      } else {
        st(r, ci + 1, { fill: rowFill, align: ci === 0 ? 'center' : 'left' });
      }
      cl.border = { bottom: { style: 'thin', color: { argb: C.slate200 } } };
    });
  });

  // --- 5. FOOTER ---
  const FTR = HDR + users.length + 2;
  sp(FTR, 1, COLS);
  gc(FTR, 1).value = `PESO AI · Generated on ${dateStr} at ${timeStr} · Confidential Report`;
  st(FTR, 1, { fg: C.slate400, size: 9, align: 'center' });

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(buffer, `PESO_Report_${now.toISOString().split('T')[0]}.xlsx`);
};