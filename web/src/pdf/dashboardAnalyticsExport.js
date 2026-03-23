/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   dashboardAnalyticsExport.js â€” PESO AI  v4
   - Inline formula column: SHORT 2-line max (readable in cell)
   - FORMULA LEGEND section at bottom of every sheet
     with full step-by-step breakdown
   - Row height 50 for formula rows so wrap shows properly
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

import ExcelJS from 'exceljs';
import { LOGO_BASE64 } from './logoBase64.js';

const triggerDownload = (buffer, filename) => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const pesoFmt = (v) =>
  v != null
    ? `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '₱0.00';

const num       = (v) => Number(v) || 0;
const pct2      = (v) => `${num(v).toFixed(1)}%`;
const sharePct  = (v, t) => t > 0 ? Math.round((num(v) / t) * 100) : 0;

const sanitizeCell = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/Ã·/g, '÷')
    .replace(/Î£/g, 'Σ')
    .replace(/âˆ’/g, '−')
    .replace(/â†’/g, '→')
    .replace(/â€”/g, '—')
    .replace(/â€"/g, '—')
    .replace(/â€“/g, '–')
    .replace(/â€˜/g, '‘')
    .replace(/â€™/g, '’')
    .replace(/Ã—/g, '×')
    .replace(/Â·/g, '·')
    .replace(/â‚±/g, '₱')
    .replace(/â‰¥/g, '≥')
    .replace(/â‰¤/g, '≤')
    .replace(/ðŸ[\u0080-\u00BF]*/g, '');
};

const asciiSafe = (value) => sanitizeCell(String(value ?? ''));

const EARLY_COLORS = {
  navy: 'FF1E3A5F',
  navyDark: 'FF0F172A',
  white: 'FFFFFFFF',
  offWhite: 'FFF8FAFC',
  slate400: 'FF94A3B8',
  green: 'FF22C55E',
  greenBg: 'FFF0FDF4',
  red: 'FFEF4444',
  redBg: 'FFFFF5F5',
  amber: 'FFF59E0B',
  amberBg: 'FFFFFBEB',
  orange: 'FFF97316',
  indigo: 'FF6366F1',
};

// â”€â”€ SHORT inline formula strings (2 lines max) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmtRatio  = (exp, inc) =>
  asciiSafe(`Exp / Inc * 100\n${pesoFmt(exp)} / ${pesoFmt(inc)} * 100 = ${inc > 0 ? pct2((exp / inc) * 100) : '0.0%'}`);

const fmtNet    = (inc, exp) =>
  asciiSafe(`Income - Expenses\n${pesoFmt(inc)} - ${pesoFmt(exp)} = ${pesoFmt(inc - exp)}`);

const fmtShare  = (spent, total, cat) =>
  asciiSafe(`${cat} / Total * 100\n${pesoFmt(spent)} / ${pesoFmt(total)} * 100 = ${sharePct(spent, total)}%`);

const fmtSavRate = (name) => {
  const map = {
    'Negative Saver': `(Inc - Exp) / Inc * 100\nResult < 0% -> Expenses exceed income`,
    'Low Saver':      `(Inc - Exp) / Inc * 100\nResult 0%-10% -> Minimal savings`,
    'Mid Saver':      `(Inc - Exp) / Inc * 100\nResult 10%-30% -> Moderate savings`,
    'High Saver':     `(Inc - Exp) / Inc * 100\nResult > 30% -> Excellent savings`,
  };
  return asciiSafe(map[name] ?? `(Inc - Exp) / Inc * 100`);
};

const fmtAvgSav = (inc, exp, sav) =>
  asciiSafe(`Avg Income - Avg Expenses\n${pesoFmt(inc)} - ${pesoFmt(exp)} = ${pesoFmt(sav)}`);

const titleCase = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

const prettyPeriodFilter = (period) => titleCase(period || 'monthly');

const formatWeekLabel = (row, idx) => {
  const startRaw = row?.week_start || row?.start_date || row?.start || row?.from;
  const endRaw = row?.week_end || row?.end_date || row?.end || row?.to;
  const start = startRaw ? new Date(startRaw) : null;
  const end = endRaw ? new Date(endRaw) : null;
  if (start && !Number.isNaN(start.getTime()) && end && !Number.isNaN(end.getTime())) {
    const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    return `${fmt.format(start)} - ${fmt.format(end)}`;
  }
  const label = String(row?.label || '').trim();
  if (label && / - | – /.test(label)) return label;
  if (label) return label;
  return `Period ${idx + 1}`;
};

const trendSavingsRateDisplay = (avgIncome, avgExpenses, avgSavings) => {
  const inc = num(avgIncome);
  const exp = num(avgExpenses);
  const sav = num(avgSavings);
  if (inc === 0 && exp > 0) return { text: 'Deficit', fg: EARLY_COLORS.red, fill: EARLY_COLORS.redBg };
  if (inc === 0 && exp === 0) return { text: '-', fg: EARLY_COLORS.slate400, fill: EARLY_COLORS.offWhite };
  const rate = (sav / inc) * 100;
  if (!Number.isFinite(rate)) return { text: '-', fg: EARLY_COLORS.slate400, fill: EARLY_COLORS.offWhite };
  if (rate < 0) return { text: 'Deficit', fg: EARLY_COLORS.red, fill: EARLY_COLORS.redBg };
  if (rate > 50) return { text: `${rate.toFixed(1)}%`, fg: EARLY_COLORS.green, fill: EARLY_COLORS.greenBg };
  if (rate >= 20) return { text: `${rate.toFixed(1)}%`, fg: EARLY_COLORS.amber, fill: EARLY_COLORS.amberBg };
  return { text: `${rate.toFixed(1)}%`, fg: EARLY_COLORS.orange, fill: EARLY_COLORS.amberBg };
};

const classifySavingsRow = (name) => {
  const key = String(name || '').trim();
  if (key === 'Deficit' || key === 'Negative Saver') return { label: 'Deficit', fg: EARLY_COLORS.red, bg: EARLY_COLORS.redBg };
  if (key === 'Low (<20%)' || key === 'Low Saver') return { label: 'Low (<20%)', fg: EARLY_COLORS.amber, bg: EARLY_COLORS.amberBg };
  if (key === 'Mid Saver') return { label: 'Moderate', fg: EARLY_COLORS.indigo, bg: EARLY_COLORS.navy };
  if (key === 'Moderate') return { label: 'Moderate', fg: EARLY_COLORS.indigo, bg: EARLY_COLORS.navy };
  if (key === 'High (>50%)' || key === 'High Saver') return { label: 'High (>50%)', fg: EARLY_COLORS.green, bg: EARLY_COLORS.greenBg };
  return { label: 'Moderate', fg: EARLY_COLORS.indigo, bg: EARLY_COLORS.navy };
};

export const generateDashboardXLSX = async ({
  kpis,
  allRiskUsers = [],
  trendFilter  = 'monthly',
  trend        = [],
  savingsDist  = [],
  categories   = [],
}) => {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  /* â”€â”€ COLOURS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const C = {
    navy:     'FF1E3A5F', navyDark: 'FF0F172A',
    white:    'FFFFFFFF', offWhite: 'FFF8FAFC',
    slate200: 'FFE2E8F0', slate400: 'FF94A3B8', slate600: 'FF475569',
    indigo:   'FF6366F1', indigoBg: 'FFEEF2FF',
    green:    'FF22C55E', greenBg:  'FFF0FDF4',
    red:      'FFEF4444', redBg:    'FFFFF5F5',
    orange:   'FFF97316',
    amber:    'FFF59E0B', amberBg:  'FFFFFBEB',
    blue:     'FF3B82F6', blueBg:   'FFEFF6FF',
    sky:      'FF93C5FD',
    teal:     'FF0D9488', tealBg:   'FFF0FDFA',
    riskHigh: 'FFEF4444', riskHighBg: 'FFFFF5F5',
    riskMed:  'FFF59E0B', riskMedBg:  'FFFFFBEB',
    riskLow:  'FF22C55E', riskLowBg:  'FFF0FDF4',
  };

  /* â”€â”€ STYLE HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const solid = (a) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: a } });
  const thin  = (a = C.slate200) => ({
    top: { style: 'thin', color: { argb: a } }, bottom: { style: 'thin', color: { argb: a } },
    left: { style: 'thin', color: { argb: a } }, right: { style: 'thin', color: { argb: a } },
  });
  const btm = (a = C.slate200) => ({ bottom: { style: 'thin', color: { argb: a } } });

const sc = (cell, { bg, fg = C.navyDark, bold = false, size = 10,
    align = 'left', valign = 'middle', wrap = false, italic = false } = {}) => {
    if (typeof cell.value === 'string') cell.value = sanitizeCell(cell.value);
    if (bg) cell.fill = solid(bg);
    cell.font      = { name: 'Calibri', size, bold, italic, color: { argb: fg } };
    cell.alignment = { horizontal: align, vertical: valign, wrapText: wrap };
  };

  /* â”€â”€ LOGO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const addLogo = (ws, wb) => {
    try {
      const clean = LOGO_BASE64.replace(/^data:image\/\w+;base64,/, '');
      ws.addImage(wb.addImage({ base64: clean, extension: 'png' }),
        { tl: { col: 0.4, row: 0.7 }, ext: { width: 90, height: 90 }, editAs: 'oneCell' });
    } catch (e) { console.warn('Logo skip:', e.message); }
  };

  /* â”€â”€ HEADER BLOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const buildHeader = (ws, wb, COLS, title, sub) => {
    for (let r = 1; r <= 5; r++) {
      ws.getRow(r).height = 22;
      for (let c = 1; c <= COLS; c++) ws.getCell(r, c).fill = solid(C.navy);
    }
    addLogo(ws, wb);
    ws.mergeCells(2, 3, 2, COLS - 1);
    ws.getCell(2, 3).value = sanitizeCell(title);
    sc(ws.getCell(2, 3), { fg: C.white, bold: true, size: 14, align: 'center' });
    ws.mergeCells(3, 3, 3, COLS - 1);
    ws.getCell(3, 3).value = sanitizeCell(sub);
    sc(ws.getCell(3, 3), { fg: C.white, size: 10, align: 'center' });
    ws.getCell(2, COLS).value = sanitizeCell(dateStr);
    sc(ws.getCell(2, COLS), { fg: C.white, size: 9, align: 'right', bold: true });
    ws.getCell(3, COLS).value = sanitizeCell(timeStr);
    sc(ws.getCell(3, COLS), { fg: C.white, size: 9, align: 'right' });
    for (let c = 1; c <= COLS; c++) {
      ws.getCell(5, c).border = {
        bottom: { style: 'thick', color: { argb: 'FF3B82F6' } },
      };
    }
  };

  /* â”€â”€ SECTION LABEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const sectionRow = (ws, row, c1, c2, label, bg = C.navyDark) => {
    ws.mergeCells(row, c1, row, c2);
    ws.getRow(row).height = 26;
    ws.getCell(row, c1).value = sanitizeCell(label);
    sc(ws.getCell(row, c1), { bg, fg: C.white, bold: true, size: 11 });
  };

  /* â”€â”€ TABLE HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const tableHeader = (ws, row, labels) => {
    ws.getRow(row).height = 30;
    labels.forEach((lbl, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = sanitizeCell(lbl); cell.border = thin();
      sc(cell, { bg: C.navyDark, fg: C.white, bold: true, size: 10, align: 'center' });
    });
  };

  /* â”€â”€ STAT CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const statCard = (ws, vRow, lRow, c1, c2, value, label, bg, valueFg = C.white, labelFg = C.white) => {
    ws.mergeCells(vRow, c1, vRow, c2);
    ws.getCell(vRow, c1).value = sanitizeCell(value);
    sc(ws.getCell(vRow, c1), { bg, fg: valueFg, bold: true, size: 22, align: 'center' });
    ws.mergeCells(lRow, c1, lRow, c2);
    ws.getCell(lRow, c1).value = sanitizeCell(label);
    sc(ws.getCell(lRow, c1), { bg, fg: labelFg, size: 9, align: 'center' });
  };

  /* â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const footer = (ws, row, COLS) => {
    ws.mergeCells(row, 1, row, COLS);
    ws.getRow(row).height = 18;
    ws.getCell(row, 1).value =
      sanitizeCell(`PESO AI · Dashboard Analytics Export · ${dateStr} ${timeStr} · Confidential`);
    sc(ws.getCell(row, 1), { fg: C.slate400, size: 9, align: 'center', italic: true });
  };

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     FORMULA LEGEND BUILDER
     Adds a full step-by-step formula reference section
     below the data table on each sheet.
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const buildLegend = (ws, startRow, COLS, entries) => {
    // Gap row
    ws.getRow(startRow).height = 10;

    // Legend header
    sectionRow(ws, startRow + 1, 1, COLS, '  FORMULA LEGEND  -  Step-by-step explanation of every calculation above', C.teal);

    // Column headers for legend table
    ws.getRow(startRow + 2).height = 28;
    [
      { v: 'Metric / Column',  w: 0.18 },
      { v: 'Formula Used',     w: 0.24 },
      { v: 'Step-by-Step Calculation',  w: 0.35 },
      { v: 'Result / Rule',    w: 0.23 },
    ].forEach(({ v }, ci) => {
      const cell = ws.getCell(startRow + 2, ci + 1);
      cell.value = v; cell.border = thin(C.teal);
      sc(cell, { bg: C.teal, fg: C.white, bold: true, size: 10, align: 'center' });
    });
    // Merge remaining cols into last visible header
    if (COLS > 4) ws.mergeCells(startRow + 2, 4, startRow + 2, COLS);

    // Data rows
    entries.forEach(({ metric, formula, steps, result }, idx) => {
      const r     = startRow + 3 + idx;
      const rowBg = idx % 2 === 0 ? C.tealBg : C.white;
      ws.getRow(r).height = 52; // tall enough to show multi-line wrap

      [
        { col: 1, val: asciiSafe(metric),  fg: C.navyDark, bold: true  },
        { col: 2, val: asciiSafe(formula), fg: C.teal,     bold: true  },
        { col: 3, val: asciiSafe(steps),   fg: C.slate600, bold: false },
        { col: 4, val: asciiSafe(result),  fg: C.navyDark, bold: true  },
      ].forEach(({ col, val, fg, bold }) => {
        const cell  = ws.getCell(r, col);
        cell.value  = val;
        cell.border = btm(C.teal);
        sc(cell, { bg: rowBg, fg, bold, size: 9, wrap: true, valign: 'top' });
      });
      // Merge result col across remaining cols if sheet is wider
      if (COLS > 4) ws.mergeCells(r, 4, r, COLS);
    });

    return startRow + 3 + entries.length; // return last used row
  };

  /* â”€â”€ WORKBOOK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PESO AI'; wb.created = now; wb.modified = now;

  const riskUsers = Array.isArray(allRiskUsers) ? allRiskUsers : [];
  const highCount = riskUsers.filter(u => u.risk_level === 'High').length;
  const medCount  = riskUsers.filter(u => u.risk_level === 'Medium').length;
  const lowCount  = riskUsers.filter(u => u.risk_level === 'Low').length;
  const trendData = Array.isArray(trend) ? trend : [];
  const totalUsers = num(kpis?.total_users);
  const pctActive  = num(kpis?.pct_active);
  const activeCount = Math.round((pctActive / 100) * totalUsers);
  const avgInc = num(kpis?.avg_income);
  const avgExp = num(kpis?.avg_expenses);
  const avgSav = num(kpis?.avg_savings);

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SHEET 1 â€” DASHBOARD OVERVIEW
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const ws1 = wb.addWorksheet('Dashboard Overview', { views: [{ showGridLines: false }] });
  ws1.columns = [
    { width: 30 }, { width: 24 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 52 },
  ];
  const C1 = 8;

  buildHeader(ws1, wb, C1,
    'DASHBOARD ANALYTICS REPORT',
    `System Records as of ${dateStr}  ·  Period: ${prettyPeriodFilter(trendFilter)}`
  );

  ws1.getRow(7).height = 40; ws1.getRow(8).height = 20; ws1.getRow(9).height = 6;
  statCard(ws1, 7, 8, 1, 2, totalUsers,            'TOTAL USERS',   C.indigo, C.white);
  statCard(ws1, 7, 8, 3, 4, `${pctActive}%`,       'ACTIVE USERS',  C.green, C.white);
  statCard(ws1, 7, 8, 5, 6, pesoFmt(avgInc),       'AVG. INCOME',   C.blue, C.green);
  statCard(ws1, 7, 8, 7, 8, pesoFmt(avgExp),       'AVG. EXPENSES', C.red, C.white);

  ws1.getRow(10).height = 40; ws1.getRow(11).height = 20; ws1.getRow(12).height = 8;
  statCard(ws1, 10, 11, 1, 2, pesoFmt(avgSav), 'AVG. SAVINGS',  C.amber, C.white);
  statCard(ws1, 10, 11, 3, 4, highCount,        'HIGH RISK',     C.riskHigh, C.white);
  statCard(ws1, 10, 11, 5, 6, medCount,         'MEDIUM RISK',   C.riskMed, C.white);
  statCard(ws1, 10, 11, 7, 8, lowCount,         'LOW RISK',      C.riskLow, C.white);

  sectionRow(ws1, 13, 1, C1, '  KPI SUMMARY TABLE');
  tableHeader(ws1, 14, ['Metric', 'Value', 'Computed As (Short)', '', '', '', '', 'Full Description']);
  ws1.mergeCells(14, 3, 14, 7);
  sc(ws1.getCell(14, 3), { bg: C.navyDark, fg: C.white, bold: true, size: 10, align: 'center' });
  ws1.autoFilter = 'A14:H14';

  const kpiRows = [
    { m: 'Total Users',       v: totalUsers,         short: `Direct DB count = ${totalUsers}`,                                         desc: 'Total registered user accounts in the system', fg: C.indigo },
    { m: 'Active Users (%)',  v: `${pctActive}%`,    short: `${activeCount} Ã· ${totalUsers} Ã— 100 = ${pctActive}%`,                    desc: 'Users who completed onboarding', fg: C.green },
    { m: 'Average Income',    v: pesoFmt(avgInc),    short: `Î£(incomes) Ã· ${totalUsers} = ${pesoFmt(avgInc)}`,                        desc: 'Mean gross income across all users', fg: C.blue },
    { m: 'Average Expenses',  v: pesoFmt(avgExp),    short: `Î£(expenses) Ã· ${totalUsers} = ${pesoFmt(avgExp)}`,                       desc: 'Mean total expenses across all users', fg: C.red },
    { m: 'Average Savings',   v: pesoFmt(avgSav),    short: `${pesoFmt(avgInc)} âˆ’ ${pesoFmt(avgExp)} = ${pesoFmt(avgSav)}`,           desc: 'Avg Income minus Avg Expenses', fg: C.amber },
    { m: 'High Risk Users',   v: highCount,          short: `Ratio > 80%  â†’  count = ${highCount}`,                                   desc: 'Users with dangerously high expense ratio', fg: C.riskHigh },
    { m: 'Medium Risk Users', v: medCount,           short: `Ratio 50â€“80%  â†’  count = ${medCount}`,                                   desc: 'Users with moderate expense ratio', fg: C.riskMed },
    { m: 'Low Risk Users',    v: lowCount,           short: `Ratio < 50%  â†’  count = ${lowCount}`,                                    desc: 'Users with healthy expense ratio', fg: C.riskLow },
    { m: 'Total Risk Users',  v: riskUsers.length,   short: `${highCount} + ${medCount} + ${lowCount} = ${riskUsers.length}`,         desc: 'High + Medium + Low risk users', fg: C.indigo },
    { m: 'Report Period',     v: trendFilter.toUpperCase(), short: `Filter: ${trendFilter.toUpperCase()}`,                             desc: 'Grouping applied to trend data', fg: C.indigo },
    { m: 'Generated At',      v: `${dateStr} ${timeStr}`,    short: `Export timestamp`,                                               desc: 'Date and time this file was exported', fg: C.slate600 },
  ];

  kpiRows.forEach(({ m, v, short, desc, fg }, idx) => {
    const r     = 15 + idx;
    const rowBg = idx % 2 === 0 ? C.white : C.offWhite;
    ws1.getRow(r).height = 26;

    ws1.getCell(r, 1).value = m; ws1.getCell(r, 1).border = btm();
    sc(ws1.getCell(r, 1), { bg: rowBg, fg: C.navyDark, bold: true, size: 10 });

    ws1.getCell(r, 2).value = v; ws1.getCell(r, 2).border = btm();
    sc(ws1.getCell(r, 2), { bg: rowBg, fg, bold: true, size: 11, align: 'center' });

    ws1.mergeCells(r, 3, r, 7);
    ws1.getCell(r, 3).value = short; ws1.getCell(r, 3).border = btm();
    sc(ws1.getCell(r, 3), { bg: rowBg, fg: C.teal, size: 10, italic: true });

    ws1.getCell(r, 8).value = desc; ws1.getCell(r, 8).border = btm();
    sc(ws1.getCell(r, 8), { bg: rowBg, fg: C.slate600, size: 10 });
  });

  const leg1Start = 15 + kpiRows.length + 1;
  const leg1End = buildLegend(ws1, leg1Start, C1, [
    { metric: 'Active Users (%)',  formula: 'Active Ã· Total Ã— 100',             steps: `Step 1: Count active users (onboarding = true) = ${activeCount}\nStep 2: Divide by total users = ${activeCount} Ã· ${totalUsers}\nStep 3: Multiply by 100 = ${pctActive}%`,  result: `${pctActive}%` },
    { metric: 'Average Income',    formula: 'Î£(All Incomes) Ã· Total Users',     steps: `Step 1: Sum all user income records\nStep 2: Divide by total users = ${totalUsers}\nStep 3: Result = ${pesoFmt(avgInc)} per user`,                                               result: pesoFmt(avgInc) },
    { metric: 'Average Expenses',  formula: 'Î£(All Expenses) Ã· Total Users',    steps: `Step 1: Sum all user expense records\nStep 2: Divide by total users = ${totalUsers}\nStep 3: Result = ${pesoFmt(avgExp)} per user`,                                              result: pesoFmt(avgExp) },
    { metric: 'Average Savings',   formula: 'Avg Income âˆ’ Avg Expenses',        steps: `Step 1: Take Avg Income = ${pesoFmt(avgInc)}\nStep 2: Subtract Avg Expenses = ${pesoFmt(avgExp)}\nStep 3: ${pesoFmt(avgInc)} âˆ’ ${pesoFmt(avgExp)} = ${pesoFmt(avgSav)}`,        result: pesoFmt(avgSav) },
    { metric: 'Risk Classification',formula: 'Expense Ratio = Exp Ã· Inc Ã— 100',steps: `HIGH RISK:   Expense Ratio > 80%  (expenses heavily exceed income)\nMEDIUM RISK: Expense Ratio 50%â€“80%  (expenses high relative to income)\nLOW RISK:    Expense Ratio < 50%  (expenses within healthy range)`,  result: 'Ratio threshold rules' },
    { metric: 'Total Risk Users',  formula: 'High + Medium + Low',              steps: `Step 1: Count High risk = ${highCount}\nStep 2: Count Medium risk = ${medCount}\nStep 3: Count Low risk = ${lowCount}\nStep 4: ${highCount} + ${medCount} + ${lowCount} = ${riskUsers.length}`, result: `${riskUsers.length} users` },
  ]);

  footer(ws1, leg1End + 2, C1);

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SHEET 2 â€” FINANCIAL TREND
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const ws2 = wb.addWorksheet('Financial Trend', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 9 }],
  });
  ws2.columns = [
    { width: 6  }, { width: 22 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 },
    { width: 16 }, { width: 16 }, { width: 46 },
  ];
  const C2 = 9;

  buildHeader(ws2, wb, C2,
    'FINANCIAL TREND DATA',
    `System Records as of ${dateStr} · Period: ${prettyPeriodFilter(trendFilter)}`
  );

  sectionRow(ws2, 7, 1, C2, `  FINANCIAL TREND TABLE  —  ${trendFilter.toUpperCase()}  ·  ${trendData.length} record(s)`);
  tableHeader(ws2, 8, ['#', 'Period', 'Avg. Income (₱)', 'Avg. Expenses (₱)', 'Avg. Savings (₱)', 'Net (Inc − Exp)', 'Savings Rate (%)', 'Status', 'Formula (Short)']);
  ws2.autoFilter = 'A8:I8';

  if (trendData.length === 0) {
    ws2.getRow(9).height = 34;
    ws2.mergeCells(9, 1, 9, C2);
    ws2.getCell(9, 1).value = 'No trend data. Switch the period filter on the dashboard and re-export.';
    ws2.getCell(9, 1).border = thin(C.amber);
    sc(ws2.getCell(9, 1), { bg: C.amberBg, fg: C.amber, size: 10, italic: true, wrap: true, align: 'center' });
  } else {
    trendData.forEach((row, idx) => {
      const r     = 9 + idx;
      const rowBg = idx % 2 === 0 ? 'FF0A1628' : 'FF0D1F3C';
      ws2.getRow(r).height = 50; // tall so 2-line wrap is fully visible

      const inc   = num(row.avg_income);
      const exp   = num(row.avg_expenses);
      const sav   = num(row.avg_savings);
      const net   = inc - exp;
      const label = trendFilter.toLowerCase() === 'weekly' ? formatWeekLabel(row, idx) : (row.label ?? `Period ${idx + 1}`);
      const rateInfo = trendSavingsRateDisplay(inc, exp, sav);
      const statusText = net > 0 ? '▲ Surplus' : net < 0 ? '▼ Deficit' : '● Break Even';
      const statusFg = net > 0 ? C.green : net < 0 ? C.red : C.amber;
      const statusBg = net > 0 ? C.greenBg : net < 0 ? C.redBg : C.amberBg;

      const setNum = (col, val, fg) => {
        const cell = ws2.getCell(r, col);
        cell.value = val; cell.numFmt = '"₱"#,##0.00'; cell.border = btm();
        sc(cell, { bg: rowBg, fg, bold: true, size: 10, align: 'right', valign: 'middle' });
      };

      ws2.getCell(r, 1).value = idx + 1; ws2.getCell(r, 1).border = btm();
      sc(ws2.getCell(r, 1), { bg: rowBg, fg: C.white, size: 10, align: 'center', valign: 'middle' });

      ws2.getCell(r, 2).value = label; ws2.getCell(r, 2).border = btm();
      sc(ws2.getCell(r, 2), { bg: rowBg, fg: C.white, bold: true, size: 10, valign: 'middle' });

      setNum(3, inc, C.green);
      setNum(4, exp, C.red);
      setNum(5, sav, sav >= 0 ? C.green : C.red);

      const cNet = ws2.getCell(r, 6);
      cNet.value = net; cNet.numFmt = '"₱"#,##0.00'; cNet.border = btm();
      sc(cNet, { bg: rowBg, fg: net >= 0 ? C.green : C.red, bold: true, size: 10, align: 'right', valign: 'middle' });

      const cRate = ws2.getCell(r, 7);
      cRate.value = rateInfo.text; cRate.border = btm();
      sc(cRate, { bg: rowBg, fg: rateInfo.fg, bold: true, size: 10, align: 'center', valign: 'middle' });

      ws2.getCell(r, 8).value = statusText; ws2.getCell(r, 8).border = btm();
      sc(ws2.getCell(r, 8), { bg: statusBg, fg: statusFg, bold: true, size: 9, align: 'center', valign: 'middle' });

      // SHORT formula â€” 2 lines max, fully visible at height 50
      ws2.getCell(r, 9).value = fmtNet(inc, exp);
      ws2.getCell(r, 9).border = btm();
      sc(ws2.getCell(r, 9), { bg: rowBg, fg: C.teal, size: 9, italic: true, wrap: true, valign: 'top' });
    });

    // Period average row
    const avgRow = 9 + trendData.length;
    ws2.getRow(avgRow).height = 28;
    const avgOf = (k) => { const v = trendData.map(r => num(r[k])); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0; };
    const pAvgInc = avgOf('avg_income'); const pAvgExp = avgOf('avg_expenses');
    const pAvgSav = avgOf('avg_savings'); const pAvgNet = pAvgInc - pAvgExp;

    ws2.mergeCells(avgRow, 1, avgRow, 2);
    ws2.getCell(avgRow, 1).value = `PERIOD AVERAGE  (${trendData.length} periods)`;
    sc(ws2.getCell(avgRow, 1), { bg: C.navyDark, fg: C.white, bold: true, size: 10, align: 'right' });

    [[3, pAvgInc], [4, pAvgExp], [5, pAvgSav], [6, pAvgNet]].forEach(([ci, val]) => {
      const cell = ws2.getCell(avgRow, ci);
      cell.value = val; cell.numFmt = '"₱"#,##0.00';
      sc(cell, { bg: C.navyDark, fg: C.white, bold: true, size: 10, align: 'right' });
    });
    ws2.getCell(avgRow, 7).value = '—';
    sc(ws2.getCell(avgRow, 7), { bg: C.navyDark, fg: C.white, size: 10, align: 'center' });
    ws2.getCell(avgRow, 8).value = '—';
    sc(ws2.getCell(avgRow, 8), { bg: C.navyDark, fg: C.white, size: 10, align: 'center' });
    ws2.getCell(avgRow, 9).value = `Avg across ${trendData.length} ${prettyPeriodFilter(trendFilter)} periods`;
    sc(ws2.getCell(avgRow, 9), { bg: C.navyDark, fg: C.white, size: 9, italic: true });

    const leg2Start = avgRow + 1;
    const leg2End = buildLegend(ws2, leg2Start, C2, [
      { metric: 'Avg. Income (Col C)',    formula: 'Î£(user incomes) Ã· user count',      steps: `Step 1: Sum all user income records for this period\nStep 2: Divide by number of active users\nStep 3: Result = average income per user for that period`,       result: 'Shown in green' },
      { metric: 'Avg. Expenses (Col D)',  formula: 'Î£(user expenses) Ã· user count',     steps: `Step 1: Sum all user expense records for this period\nStep 2: Divide by number of active users\nStep 3: Result = average expenses per user for that period`,    result: 'Shown in red' },
      { metric: 'Avg. Savings (Col E)',   formula: 'Î£(user savings) Ã· user count',      steps: `Step 1: Sum (income âˆ’ expenses) for each user\nStep 2: Divide by number of active users\nStep 3: Result = average net savings per user for that period`,      result: 'Shown in green/red' },
      { metric: 'Net (Col F)',            formula: 'Avg Income âˆ’ Avg Expenses',         steps: `Step 1: Take Avg Income for this period (Col C)\nStep 2: Subtract Avg Expenses for this period (Col D)\nStep 3: Positive = Surplus (income > expenses)  |  Negative = Deficit`,         result: 'Green = surplus  Red = deficit' },
      { metric: 'Savings Rate (Col G)',   formula: 'Savings ÷ Income × 100',            steps: `Step 1: Take Avg Savings from Col E\nStep 2: Divide by Avg Income from Col C\nStep 3: Show Deficit when income = 0 and expenses > 0`, result: 'Color coded by threshold' },
      { metric: 'Period Average (last row)', formula: 'Î£(all period values) Ã· period count', steps: `Step 1: Sum all rows in each column (C, D, E, F)\nStep 2: Divide by total number of periods (${trendData.length})\nStep 3: Shows overall trend average across the full date range`, result: `${trendData.length} periods averaged` },
    ]);

    footer(ws2, leg2End + 2, C2);
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SHEET 3 â€” CATEGORY SPENDING
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const ws3 = wb.addWorksheet('Category Spending', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 8 }],
  });
  ws3.columns = [
    { width: 6  }, { width: 30 }, { width: 20 },
    { width: 14 }, { width: 16 }, { width: 44 },
  ];
  const C3 = 6;

  buildHeader(ws3, wb, C3,
    'TOP SPENDING CATEGORIES',
    `Column F = short formula  Â·  See FORMULA LEGEND below for full breakdown`
  );

  sectionRow(ws3, 7, 1, C3, '  CATEGORY SPENDING BREAKDOWN');
  tableHeader(ws3, 8, ['#', 'Category', 'Total Spent (â‚±)', 'Share (%)', 'Status', 'Formula (Short)']);
  ws3.autoFilter = 'A8:F8';

  const categoryOrder = ['Bills & Utilities', 'Food & Dining', 'Shopping', 'Transportation', 'Health', 'Entertainment', 'Groceries'];
  const byName = new Map((Array.isArray(categories) ? categories : []).map((c) => [String(c.category || '').trim(), c]));
  const top6      = categoryOrder.map((name) => byName.get(name) || { category: name, total_spent: 0 });
  const top6Total = top6.reduce((s, c) => s + num(c.total_spent), 0);

  top6.forEach((cat, idx) => {
    const r      = 9 + idx;
    const rowBg  = idx % 2 === 0 ? C.white : C.offWhite;
    const spent  = num(cat.total_spent);
    const share  = sharePct(spent, top6Total);
    const isNoData = spent <= 0 || cat.category === 'Groceries';
    const isCaution = ['Bills & Utilities', 'Food & Dining'].includes(cat.category);
    const status = isNoData ? 'No data yet' : isCaution ? 'Caution' : 'Normal';
    const sFg    = isNoData ? C.slate400 : isCaution ? C.amber : C.indigo;
    const sBg    = isNoData ? C.offWhite : isCaution ? C.navyDark : C.navy;

    ws3.getRow(r).height = 50;

    ws3.getCell(r, 1).value = idx + 1; ws3.getCell(r, 1).border = btm();
    sc(ws3.getCell(r, 1), { bg: rowBg, fg: C.slate400, size: 10, align: 'center', valign: 'middle' });

    ws3.getCell(r, 2).value = cat.category ?? 'â€”'; ws3.getCell(r, 2).border = btm();
    sc(ws3.getCell(r, 2), { bg: rowBg, fg: C.navyDark, bold: true, size: 10, valign: 'middle' });

    const cS = ws3.getCell(r, 3);
    cS.value = spent; cS.numFmt = '"₱"#,##0.00'; cS.border = btm();
    sc(cS, { bg: rowBg, fg: C.navyDark, size: 10, align: 'right', valign: 'middle' });

    const cSh = ws3.getCell(r, 4);
    cSh.value = share; cSh.numFmt = '0"%"'; cSh.border = btm();
    sc(cSh, { bg: rowBg, fg: C.indigo, bold: true, size: 10, align: 'center', valign: 'middle' });

    ws3.getCell(r, 5).value = status; ws3.getCell(r, 5).border = btm();
    sc(ws3.getCell(r, 5), { bg: sBg, fg: sFg, bold: true, size: 9, align: 'center', valign: 'middle' });

    // SHORT formula â€” 2 lines
    ws3.getCell(r, 6).value = isNoData ? 'No spend recorded for this period' : fmtShare(spent, top6Total, cat.category ?? 'Cat');
    ws3.getCell(r, 6).border = btm();
    sc(ws3.getCell(r, 6), { bg: rowBg, fg: C.teal, size: 9, italic: true, wrap: true, valign: 'top' });
  });

  // Totals row
  const catTot = 9 + top6.length;
  ws3.getRow(catTot).height = 28;
  ws3.mergeCells(catTot, 1, catTot, 2);
  ws3.getCell(catTot, 1).value = 'TOTAL (Top 7)';
  sc(ws3.getCell(catTot, 1), { bg: C.navyDark, fg: C.white, bold: true, size: 10, align: 'right' });
  const cT = ws3.getCell(catTot, 3);
  cT.value = top6Total; cT.numFmt = '"₱"#,##0.00';
  sc(cT, { bg: C.navyDark, fg: C.white, bold: true, size: 11, align: 'right' });
  ws3.getCell(catTot, 4).value = '100%';
  sc(ws3.getCell(catTot, 4), { bg: C.navyDark, fg: C.white, bold: true, size: 11, align: 'center' });
  ws3.mergeCells(catTot, 5, catTot, C3);
  ws3.getCell(catTot, 5).value = `Σ Top-7 = ${top6.map(c => pesoFmt(num(c.total_spent))).join(' + ')} = ${pesoFmt(top6Total)}`;
  sc(ws3.getCell(catTot, 5), { bg: C.navyDark, fg: C.white, size: 9, italic: true, wrap: true });

  const leg3Start = catTot + 1;
  const leg3End = buildLegend(ws3, leg3Start, C3, [
    { metric: 'Share % (Col D)',    formula: 'Category Spend Ã· Total Ã— 100',   steps: `Step 1: Take total spent for this category (Col C)\nStep 2: Divide by sum of all 7 categories = ${pesoFmt(top6Total)}\nStep 3: Multiply by 100 to get percentage`,  result: 'Higher % = larger budget portion' },
    { metric: 'Status (Col E)',     formula: 'Category rule check',            steps: `CAUTION: Bills & Utilities or Food & Dining\nNORMAL: Shopping, Transportation, Health, Entertainment\nNO DATA: Category total spend = 0`,         result: 'Colour-coded badge' },
    { metric: 'TOTAL row',         formula: 'Î£(all category totals)',          steps: `Step 1: Add up spent amounts for all 7 categories\nStep 2: ${top6.map(c => pesoFmt(num(c.total_spent))).join(' + ')}\nStep 3: = ${pesoFmt(top6Total)}`,                  result: pesoFmt(top6Total) },
  ]);
  footer(ws3, leg3End + 2, C3);

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SHEET 4 â€” SAVINGS DISTRIBUTION
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const ws4 = wb.addWorksheet('Savings Distribution', { views: [{ showGridLines: false }] });
  ws4.columns = [
    { width: 22 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 38 },
  ];
  const C4 = 5;

  buildHeader(ws4, wb, C4,
    'SAVINGS DISTRIBUTION',
    `Count, share, status, and a compact visual bar for each saver group`
  );

  sectionRow(ws4, 7, 1, C4, '  SAVER CLASSIFICATION BREAKDOWN');
  tableHeader(ws4, 8, ['Classification', 'Count', 'Share (%)', 'Status', 'Distribution Bar']);
  ws4.autoFilter = 'A8:E8';

  const savOrder = [
    { key: 'Deficit', label: 'Deficit' },
    { key: 'Low (<20%)', label: 'Low (<20%)' },
    { key: 'Moderate', label: 'Moderate' },
    { key: 'High (>50%)', label: 'High (>50%)' },
  ];
  const savRows = Array.isArray(savingsDist) ? savingsDist : [];
  const savByName = new Map(savRows.map((d) => [String(d.name || '').trim(), d]));
  const savTotal = savRows.reduce((s, d) => s + num(d.value), 0);

  savOrder.forEach((item, idx) => {
    const source = savByName.get(item.key)
      || savByName.get(item.label)
      || { name: item.key, value: 0 };
    const r = 9 + idx;
    const rowBg = idx % 2 === 0 ? C.navyDark : 'FF0D1F3C';
    const meta = classifySavingsRow(item.key);
    const count = num(source.value);
    const share = sharePct(count, savTotal);
    const blocks = count > 0 ? Math.max(2, Math.min(20, Math.round((share / 100) * 20))) : 0;
    const bar = blocks > 0 ? '█'.repeat(blocks) : 'No data';
    ws4.getRow(r).height = 28;

    ws4.getCell(r, 1).value = meta.label; ws4.getCell(r, 1).border = btm(C.navy);
    sc(ws4.getCell(r, 1), { bg: rowBg, fg: C.white, bold: true, size: 10, valign: 'middle' });

    ws4.getCell(r, 2).value = count; ws4.getCell(r, 2).border = btm(C.navy);
    sc(ws4.getCell(r, 2), { bg: rowBg, fg: C.white, bold: true, size: 12, align: 'center', valign: 'middle' });

    const cSh = ws4.getCell(r, 3);
    cSh.value = share; cSh.numFmt = '0"%"'; cSh.border = btm(C.navy);
    sc(cSh, { bg: rowBg, fg: C.white, bold: true, size: 10, align: 'center', valign: 'middle' });

    ws4.getCell(r, 4).value = item.key === 'Negative Saver' ? 'Deficit' : meta.label;
    ws4.getCell(r, 4).border = btm(C.navy);
    sc(ws4.getCell(r, 4), {
      bg: meta.bg,
      fg: meta.fg,
      bold: true,
      size: 9,
      align: 'center',
      valign: 'middle',
    });

    ws4.getCell(r, 5).value = bar;
    ws4.getCell(r, 5).border = btm(C.navy);
    sc(ws4.getCell(r, 5), { bg: rowBg, fg: meta.fg, bold: true, size: 10, align: 'left', valign: 'middle' });
  });

  const totalRow4 = 9 + savOrder.length;
  ws4.getRow(totalRow4).height = 28;
  ws4.getCell(totalRow4, 1).value = 'TOTAL';
  ws4.getCell(totalRow4, 1).border = { top: { style: 'thick', color: { argb: C.navy } } };
  sc(ws4.getCell(totalRow4, 1), { bg: C.navy, fg: C.white, bold: true, size: 10, align: 'right' });

  const totalCountCell4 = ws4.getCell(totalRow4, 2);
  totalCountCell4.value = savTotal;
  totalCountCell4.border = { top: { style: 'thick', color: { argb: C.navy } } };
  sc(totalCountCell4, { bg: C.navy, fg: C.white, bold: true, size: 11, align: 'center' });

  const totalShareCell4 = ws4.getCell(totalRow4, 3);
  totalShareCell4.value = 100;
  totalShareCell4.numFmt = '0"%"';
  totalShareCell4.border = { top: { style: 'thick', color: { argb: C.navy } } };
  sc(totalShareCell4, { bg: C.navy, fg: C.white, bold: true, size: 11, align: 'center' });

  ws4.getCell(totalRow4, 4).value = 'TOTAL';
  ws4.getCell(totalRow4, 4).border = { top: { style: 'thick', color: { argb: C.navy } } };
  sc(ws4.getCell(totalRow4, 4), { bg: C.navy, fg: C.sky, bold: true, size: 10, align: 'center' });

  ws4.getCell(totalRow4, 5).value = '█'.repeat(20);
  ws4.getCell(totalRow4, 5).border = { top: { style: 'thick', color: { argb: C.navy } } };
  sc(ws4.getCell(totalRow4, 5), { bg: C.navy, fg: C.green, bold: true, size: 10, align: 'left' });

  const leg4Start = totalRow4 + 1;
  ws4.getRow(leg4Start).height = 10;
  sectionRow(ws4, leg4Start + 1, 1, C4, '  SAVINGS GUIDE');
  ws4.mergeCells(leg4Start + 2, 1, leg4Start + 2, 5);
  ws4.getRow(leg4Start + 2).height = 32;
  ws4.getCell(leg4Start + 2, 1).value = 'Deficit = expenses exceed income. Low = under 20%. Moderate = 20% to 50%. High = above 50%.';
  sc(ws4.getCell(leg4Start + 2, 1), { bg: C.tealBg, fg: C.navyDark, bold: true, size: 9, align: 'center', wrap: true });
  footer(ws4, leg4Start + 4, C4);

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SHEET 5 â€” RISK USERS
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const ws5 = wb.addWorksheet('Risk Users', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 10 }],
  });
  ws5.columns = [
    { width: 6  }, { width: 22 }, { width: 28 },
    { width: 20 }, { width: 20 }, { width: 14 },
    { width: 14 }, { width: 34 }, { width: 42 },
  ];
  const C5 = 9;

  buildHeader(ws5, wb, C5,
    'RISK USERS REPORT',
    `Column H = short formula  ·  Column I = inline breakdown  ·  See FORMULA LEGEND below`
  );

  ws5.getRow(7).height = 40; ws5.getRow(8).height = 20; ws5.getRow(9).height = 8;
  statCard(ws5, 7, 8, 1, 3, highCount, 'HIGH',   C.riskHighBg, C.riskHigh, C.riskHigh);
  statCard(ws5, 7, 8, 4, 6, medCount,  'MEDIUM', C.riskMedBg,  C.riskMed,  C.riskMed);
  statCard(ws5, 7, 8, 7, 9, lowCount,  'LOW',    C.riskLowBg,  C.riskLow,  C.riskLow);

  tableHeader(ws5, 10, [
    '#', 'Full Name', 'Email',
    'Avg. Income (₱)', 'Avg. Expenses (₱)', 'Exp. Ratio', 'Risk Level',
    'Formula (Short)', 'User Breakdown',
  ]);
  ws5.autoFilter = 'A10:I10';

  riskUsers.forEach((u, idx) => {
    const r     = 11 + idx;
    const rl    = u.risk_level;
    const rFg   = rl === 'High' ? C.riskHigh : rl === 'Medium' ? C.riskMed : C.riskLow;
    const rBg   = rl === 'High' ? C.riskHighBg : rl === 'Medium' ? C.riskMedBg : C.riskLowBg;
    const rowBg = idx % 2 === 0 ? C.navyDark : 'FF0D1F3C';
    const name  = titleCase([u.first_name, u.last_name].filter(Boolean).join(' ')) || '—';
    const uInc  = num(u.avg_income ?? u.total_income);
    const uExp  = num(u.avg_expenses ?? u.total_expenses);
    const ratio = num(u.expense_ratio);
    ws5.getRow(r).height = 54;

    ws5.getCell(r, 1).value = idx + 1; ws5.getCell(r, 1).border = btm();
    sc(ws5.getCell(r, 1), { bg: rowBg, fg: C.slate400, size: 10, align: 'center', valign: 'middle' });

    ws5.getCell(r, 2).value = name; ws5.getCell(r, 2).border = btm(C.navy);
    sc(ws5.getCell(r, 2), { bg: rowBg, fg: C.white, bold: true, size: 10, valign: 'middle' });

    ws5.getCell(r, 3).value = u.email ?? '—'; ws5.getCell(r, 3).border = btm(C.navy);
    sc(ws5.getCell(r, 3), { bg: rowBg, fg: C.slate400, size: 10, valign: 'middle' });

    const cInc = ws5.getCell(r, 4);
    cInc.value = uInc; cInc.numFmt = '"₱"#,##0.00'; cInc.border = btm(C.navy);
    sc(cInc, { bg: rowBg, fg: C.green, size: 10, align: 'right', valign: 'middle' });

    const cExp = ws5.getCell(r, 5);
    cExp.value = uExp; cExp.numFmt = '"₱"#,##0.00'; cExp.border = btm(C.navy);
    sc(cExp, { bg: rowBg, fg: C.red, size: 10, align: 'right', valign: 'middle' });

    const ratioFg = ratio >= 100 ? C.red : ratio >= 50 ? C.orange : C.green;
    ws5.getCell(r, 6).value = `${ratio.toFixed(1)}%`; ws5.getCell(r, 6).border = btm(C.navy);
    sc(ws5.getCell(r, 6), { bg: rowBg, fg: ratioFg, bold: true, size: 10, align: 'center', valign: 'middle' });

    ws5.getCell(r, 7).value = rl ?? '—'; ws5.getCell(r, 7).border = btm(C.navy);
    sc(ws5.getCell(r, 7), { bg: rBg, fg: rFg, bold: true, size: 9, align: 'center', valign: 'middle' });

    // SHORT formula â€” 2 lines max, fully visible at height 50
    ws5.getCell(r, 8).value = fmtRatio(uExp, uInc);
    ws5.getCell(r, 8).border = btm(C.navy);
    sc(ws5.getCell(r, 8), { bg: rowBg, fg: C.teal, size: 9, italic: true, wrap: true, valign: 'top' });

    const inlineRatio = `${pesoFmt(uExp)} ÷ ${pesoFmt(uInc)} × 100 = ${uInc > 0 ? pct2((uExp / uInc) * 100) : '0.0%'} → ${rl ?? '—'}`;
    ws5.getCell(r, 9).value = inlineRatio;
    ws5.getCell(r, 9).border = btm(C.navy);
    sc(ws5.getCell(r, 9), { bg: rowBg, fg: C.slate400, size: 9, italic: true, wrap: true, valign: 'top' });
  });

  const leg5Start = 11 + riskUsers.length + 1;
  const leg5End = buildLegend(ws5, leg5Start, C5, [
    { metric: 'Expense Ratio (Col F)',  formula: 'Avg. Expenses ÷ Avg. Income × 100',  steps: `Step 1: Take user's Avg. Expenses (Col E)\nStep 2: Divide by user's Avg. Income (Col D)\nStep 3: Multiply by 100 to get expense ratio %`,   result: 'Higher % = more financial risk' },
    { metric: 'HIGH RISK classification',   formula: 'Expense Ratio >= 80%',              steps: `Condition: Expense Ratio is GREATER THAN OR EQUAL TO 80%\nMeaning: User spends most or more than all of their income\nAction: Immediate financial intervention recommended`, result: 'Ratio >= 80%' },
    { metric: 'MEDIUM RISK classification', formula: 'Expense Ratio 50% â€“ 79%',          steps: `Condition: Expense Ratio is between 50% and 79%\nMeaning: User spends more than half their income\nRecommendation: Monitor closely, reduce non-essential expenses`,    result: 'Ratio 50%â€“79%' },
    { metric: 'LOW RISK classification',    formula: 'Expense Ratio < 50%',              steps: `Condition: Expense Ratio is LESS THAN 50%\nMeaning: User spends less than half their income\nResult: Healthy financial behaviour, continue good habits`,           result: 'Ratio < 50%' },
  ]);
  footer(ws5, leg5End + 2, C5);

  /* â”€â”€ WRITE & DOWNLOAD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(buffer, `PESO_Dashboard_Analytics_${now.toISOString().split('T')[0]}.xlsx`);
};


