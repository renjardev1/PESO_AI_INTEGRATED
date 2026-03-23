import { RISK_THRESHOLDS, SPENDING_THRESHOLDS } from '../utils/formulaEngine';

/* ══════════════════════════════════════════════════════════════
   PDF SECTIONS CONFIG
══════════════════════════════════════════════════════════════ */
export const PDF_SECTIONS = [
  { id: 'kpis',       label: 'KPI Summary',             desc: 'Total users, income, expenses, savings',  icon: '📊' },
  { id: 'trend',      label: 'Financial Trend Table',   desc: 'Income / Expenses / Savings over time',   icon: '📈' },
  { id: 'savings',    label: 'Savings Distribution',    desc: 'Saver classification breakdown',          icon: '🥧' },
  { id: 'categories', label: 'Top Spending Categories', desc: 'Category shares and spend status',        icon: '💸' },
  { id: 'risk',       label: 'Risk Users Table',        desc: 'High/Medium/Low risk user list',          icon: '⚠️' },
];

/* ── Layout constants ────────────────────────────────────────── */
export const PW = 595.28, PH = 841.89, ML = 36, MR = 36, CW = PW - ML - MR;
const ROW_H     = 24;
const HDR_H     = 26;
const SECTION_H = 30;
const CELL_PAD  = 8;
const PAGE_TOP  = 42;
const PAGE_BOT  = PH - 36;

/* ── Colour palette ──────────────────────────────────────────── */
export const C = {
  navy:       [15,  30,  65 ],
  navyDark:   [10,  18,  40 ],
  teal:       [13,  148, 136],
  blue:       [37,  99,  235],
  white:      [255, 255, 255],
  offWhite:   [245, 247, 250],
  stripe:     [249, 250, 252],
  line:       [210, 218, 230],
  textDark:   [10,  15,  30 ],
  textMid:    [40,  55,  80 ],
  textMuted:  [80,  95,  115],
  green:      [15,  130, 55 ],
  greenLt:    [209, 250, 229],
  red:        [185, 28,  28 ],
  redLt:      [254, 218, 218],
  amber:      [146, 64,  14 ],
  amberLt:    [254, 237, 188],
  indigo:     [55,  48,  195],
  indigoLt:   [214, 219, 255],
  shadow:     [200, 215, 240],
};

/* ── Helpers ─────────────────────────────────────────────────── */
const setFont = (doc, style, size, color) => {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};

/* Dashboard PDF theme helpers */
const D = {
  page:        [10, 22, 40],
  surface:     [10, 22, 40],
  surfaceAlt:  [13, 31, 60],
  surfaceSoft: [13, 31, 60],
  line:        [30, 58, 95],
  text:        [255, 255, 255],
  textMuted:   [148, 163, 184],
  blue:        [37, 99, 235],
  blueDark:    [30, 64, 175],
  blueSoft:    [219, 234, 254],
  green:       [34, 197, 94],
  greenDark:   [22, 163, 74],
  greenSoft:   [220, 252, 231],
  amber:       [234, 179, 8],
  amberDark:   [217, 119, 6],
  amberSoft:   [254, 243, 199],
  orange:      [249, 115, 22],
  red:         [239, 68, 68],
  redDark:     [220, 38, 38],
  redSoft:     [254, 226, 226],
  gray:        [100, 116, 139],
};

const savingsRateColor = (rate) => {
  const n = Number(rate);
  if (!Number.isFinite(n) || n < 20) return D.red;
  if (n <= 50) return D.amber;
  return D.green;
};

const expRatioColor = (ratio) => {
  const n = Number(ratio);
  if (!Number.isFinite(n) || n >= 100) return D.red;
  if (n >= 50) return D.orange;
  return D.green;
};

const formatTrendLabel = (row, period) => {
  const raw = String(row?.label || '').trim();
  if (!period || period.toLowerCase() !== 'weekly') return raw || '-';
  if (raw.includes(' - ') || raw.includes(' – ')) return raw;
  const start = row?.start_date || row?.week_start || row?.start || row?.from || row?.date_start;
  const end = row?.end_date || row?.week_end || row?.end || row?.to || row?.date_end;
  const parse = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const s = parse(start);
  const e = parse(end);
  if (s && e) {
    const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    return `${fmt.format(s)} - ${fmt.format(e)}`;
  }
  return raw || '-';
};

const getTrendRateDisplay = (avgIncome, avgExpenses, avgSavings) => {
  const inc = Number(avgIncome) || 0;
  const exp = Number(avgExpenses) || 0;
  const sav = Number(avgSavings) || 0;
  if (inc === 0 && exp > 0) return { text: 'Deficit', color: D.red };
  if (inc === 0 && exp === 0) return { text: '—', color: D.gray };
  const rate = (sav / inc) * 100;
  if (!Number.isFinite(rate)) return { text: '—', color: D.gray };
  if (rate < 0) return { text: `${rate.toFixed(1)}%`, color: D.red };
  if (rate > 50) return { text: `${rate.toFixed(1)}%`, color: D.green };
  if (rate >= 20) return { text: `${rate.toFixed(1)}%`, color: D.amber };
  return { text: `${rate.toFixed(1)}%`, color: D.orange };
};

const drawDashboardPill = (doc, { x, y, w, h, text, bg, tc, border = tc, fontSize = 8 }) => {
  doc.setFillColor(...bg);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
  doc.setDrawColor(...border);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'S');
  setFont(doc, 'bold', fontSize, tc);
  doc.text(String(text), x + w / 2, y + h - 4, { align: 'center' });
};

const drawDashboardFooter = (doc, pageNum, totalPages, dateStr) => {
  doc.setFillColor(...D.surfaceAlt);
  doc.rect(0, PH - 30, PW, 30, 'F');
  doc.setFillColor(...D.blue);
  doc.rect(0, PH - 30, PW, 2, 'F');
  setFont(doc, 'normal', 7.5, D.textMuted);
  doc.text('CONFIDENTIAL · FOR INTERNAL USE ONLY', ML, PH - 11);
  doc.text(`Generated by PESO AI Admin System · ${dateStr}`, PW / 2, PH - 11, { align: 'center' });
  doc.text(`Page ${pageNum} of ${totalPages}`, PW - MR, PH - 11, { align: 'right' });
};

const drawDashboardHeader = (doc, { logoB64, period, dateStr }) => {
  doc.setFillColor(...D.page);
  doc.rect(0, 0, PW, PH, 'F');
  doc.setFillColor(...D.blue);
  doc.rect(0, 0, PW, 4, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.7);
  doc.line(ML, 50, PW - MR, 50);

  if (logoB64) {
    try { doc.addImage(logoB64, 'PNG', ML, 16, 24, 24); } catch (_) {}
  }

  setFont(doc, 'bold', 14, D.text);
  doc.text('PESO AI', ML + 32, 28);
  setFont(doc, 'normal', 8.5, D.textMuted);
  doc.text('Admin Analytics Dashboard Report', ML + 32, 38);
  doc.setDrawColor(...D.blue);
  doc.setLineWidth(1.2);
  doc.line(ML + 32, 42, ML + 155, 42);

  setFont(doc, 'normal', 8.5, D.textMuted);
  doc.text(`${period} Period`, PW - MR, 28, { align: 'right' });
  doc.text(dateStr, PW - MR, 40, { align: 'right' });
};

const drawDashboardCover = (doc, { logoB64, dateStr, timeStr, period, selected, dashboardData }) => {
  doc.setFillColor(...D.page);
  doc.rect(0, 0, PW, PH, 'F');
  doc.setFillColor(...D.blue);
  doc.rect(0, 0, PW, 4, 'F');

  if (logoB64) {
    try { doc.addImage(logoB64, 'PNG', ML, 36, 48, 48); } catch (_) {}
  }

  const titleX = ML + (logoB64 ? 62 : 0);
  setFont(doc, 'bold', 26, D.text);
  doc.text('PESO AI', titleX, 58);
  setFont(doc, 'normal', 11.5, D.textMuted);
  doc.text('Admin Analytics Dashboard Report', titleX, 76);
  doc.setDrawColor(...D.blue);
  doc.setLineWidth(1.5);
  doc.line(titleX, 84, titleX + 170, 84);
  setFont(doc, 'normal', 9, D.textMuted);
  doc.text('Admin Analytics Report - Monthly Period', titleX, 98);

  const cardY = 132;
  doc.setFillColor(...D.surfaceSoft);
  doc.roundedRect(ML, cardY, CW, 158, 12, 12, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(1);
  doc.roundedRect(ML, cardY, CW, 158, 12, 12, 'S');
  doc.setFillColor(...D.blue);
  doc.roundedRect(ML, cardY, 6, 158, 3, 3, 'F');

  setFont(doc, 'bold', 9, D.blueDark);
  doc.text('REPORT DETAILS', ML + 18, cardY + 20);

  const details = [
    ['Generated On', dateStr],
    ['Time', timeStr],
    ['Period Filter', period],
    ['Selected Sections', selected.map((s) => ({
      kpis: 'KPI Summary',
      trend: 'Financial Trend',
      savings: 'Savings Distribution',
      categories: 'Top Spending',
      risk: 'Risk Users',
    }[s] || s)).join('  ·  ')],
    ['Total Users', String(dashboardData.kpis?.total_users ?? '-')],
  ];

  details.forEach(([label, value], i) => {
    const rowY = cardY + 42 + i * 20;
    setFont(doc, 'normal', 8.5, D.textMuted);
    doc.text(label, ML + 18, rowY);
    setFont(doc, 'bold', 8.8, D.text);
    doc.text(String(value), ML + 130, rowY);
  });

  const sectionY = 318;
  setFont(doc, 'bold', 9, D.blueDark);
  doc.text('SECTIONS INCLUDED', ML, sectionY);
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.8);
  doc.line(ML, sectionY + 4, ML + 170, sectionY + 4);

  const sectionLabels = {
    kpis: '01  KPI SUMMARY',
    trend: '02  FINANCIAL TREND TABLE',
    savings: '03  SAVINGS DISTRIBUTION',
    categories: '04  TOP SPENDING CATEGORIES',
    risk: '05  RISK USERS TABLE',
  };
  const cols = 2;
  const gapX = 12;
  const itemW = (CW - gapX) / cols;
  selected.forEach((sid, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = ML + col * (itemW + gapX);
    const y = sectionY + 16 + row * 24;
    doc.setFillColor(...D.blueSoft);
    doc.circle(x + 5, y - 3, 3, 'F');
    setFont(doc, 'bold', 8.3, D.text);
    doc.text(sectionLabels[sid] || String(sid).toUpperCase(), x + 14, y);
  });

  const noteY = 402;
  doc.setFillColor(...D.surface);
  doc.roundedRect(ML, noteY, CW, 42, 10, 10, 'F');
  doc.setDrawColor(...D.line);
  doc.roundedRect(ML, noteY, CW, 42, 10, 10, 'S');
  setFont(doc, 'normal', 8.5, D.textMuted);
  doc.text('All figures are pulled from the current dashboard state at export time.', ML + 14, noteY + 18);
  doc.text(`Exported on ${dateStr} at ${timeStr}`, ML + 14, noteY + 31);
};

const drawDashboardSectionTitle = (doc, y, title, subtitle = '') => {
  doc.setFillColor(...D.surfaceAlt);
  doc.roundedRect(ML, y, CW, 26, 10, 10, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.8);
  doc.roundedRect(ML, y, CW, 26, 10, 10, 'S');
  doc.setFillColor(...D.blue);
  doc.roundedRect(ML, y, 4, 26, 4, 4, 'F');
  setFont(doc, 'bold', 10, D.text);
  doc.text(title.toUpperCase(), ML + 14, y + 17);
  if (subtitle) {
    setFont(doc, 'normal', 7.5, D.textMuted);
    doc.text(subtitle, PW - MR, y + 17, { align: 'right' });
  }
  return y + 34;
};

const drawDashboardKpis = (doc, y, dashboardData) => {
  const k = dashboardData.kpis || {};
  const cards = [
    { label: 'Total Users', value: String(k.total_users ?? '-'), icon: 'U', valueColor: D.text, badge: null },
    { label: 'Active Users', value: `${k.pct_active ?? 0}%`, icon: 'A', valueColor: D.greenDark, badge: { text: 'Up', bg: D.greenSoft, tc: D.greenDark } },
    { label: 'Avg. Income', value: fmtPDF(k.avg_income), icon: 'I', valueColor: D.greenDark, badge: { text: 'Up', bg: D.greenSoft, tc: D.greenDark } },
    { label: 'Avg. Expenses', value: fmtPDF(k.avg_expenses), icon: 'E', valueColor: D.redDark, badge: { text: 'Down', bg: D.redSoft, tc: D.redDark } },
    { label: 'Avg. Savings', value: fmtPDF(k.avg_savings), icon: 'S', valueColor: D.amberDark, badge: { text: 'Up', bg: D.amberSoft, tc: D.amberDark } },
  ];
  const gap = 8;
  const cardW = (CW - gap * 4) / 5;
  const cardH = 76;
  cards.forEach((card, idx) => {
    const x = ML + idx * (cardW + gap);
    doc.setFillColor(...D.surface);
    doc.roundedRect(x, y, cardW, cardH, 10, 10, 'F');
    doc.setDrawColor(...D.line);
    doc.setLineWidth(0.9);
    doc.roundedRect(x, y, cardW, cardH, 10, 10, 'S');
    doc.setFillColor(...D.blueSoft);
    doc.circle(x + 14, y + 16, 9, 'F');
    setFont(doc, 'bold', 8, D.blueDark);
    doc.text(card.icon, x + 14, y + 18, { align: 'center' });
    setFont(doc, 'normal', 7.2, D.textMuted);
    doc.text(card.label.toUpperCase(), x + 28, y + 18);
    setFont(doc, 'bold', 15, card.valueColor);
    doc.text(card.value, x + 14, y + 40);
    if (card.badge) {
      drawDashboardPill(doc, {
        x: x + 14,
        y: y + 50,
        w: 34,
        h: 14,
        text: card.badge.text,
        bg: card.badge.bg,
        tc: card.badge.tc,
        border: card.badge.tc,
        fontSize: 7.2,
      });
    }
  });
  return y + cardH + 14;
};

const drawDashboardTrend = (doc, y, trend, period, headerCtx = {}) => {
  y = drawDashboardSectionTitle(doc, y, 'Financial Trend Table', `${period} period`);
  const rows = Array.isArray(trend) ? trend : [];
  const headerH = 24;
  const rowH = 24;
  const noteH = 34;
  const cols = [
    { label: 'PERIOD / LABEL', width: CW * 0.22, align: 'left' },
    { label: 'AVG. INCOME', width: CW * 0.19, align: 'right' },
    { label: 'AVG. EXPENSES', width: CW * 0.19, align: 'right' },
    { label: 'AVG. SAVINGS', width: CW * 0.19, align: 'right' },
    { label: 'SAVINGS RATE', width: CW * 0.21, align: 'right' },
  ];

  const drawHeader = (headerY) => {
    doc.setFillColor(...D.blueDark);
    doc.rect(ML, headerY, CW, headerH, 'F');
    doc.setDrawColor(...D.line);
    doc.setLineWidth(0.9);
    doc.rect(ML, headerY, CW, headerH, 'S');
    let x = ML;
    cols.forEach((col) => {
      setFont(doc, 'bold', 8.2, D.surface);
      const tx = col.align === 'right' ? x + col.width - 8 : col.align === 'center' ? x + col.width / 2 : x + 8;
      doc.text(col.label, tx, headerY + 16, { align: col.align });
      x += col.width;
    });
  };

  const drawRow = (rowY, row, idx) => {
    const bg = idx % 2 === 0 ? D.surface : D.surfaceAlt;
    doc.setFillColor(...bg);
    doc.rect(ML, rowY, CW, rowH, 'F');
    doc.setDrawColor(...D.line);
    doc.setLineWidth(0.5);
    doc.line(ML, rowY + rowH, ML + CW, rowY + rowH);

    const inc = Number(row.avg_income || 0);
    const exp = Number(row.avg_expenses || 0);
    const sav = Number(row.avg_savings || 0);
    const rateInfo = getTrendRateDisplay(inc, exp, sav);
    const values = [
      formatTrendLabel(row, period),
      fmtPDF(inc),
      fmtPDF(exp),
      fmtPDF(sav),
      rateInfo.text,
    ];

    let cellX = ML;
    values.forEach((value, ci) => {
      const col = cols[ci];
      const align = col.align || 'left';
      const tx = align === 'right' ? cellX + col.width - 8 : align === 'center' ? cellX + col.width / 2 : cellX + 8;
      const color = ci === 4 ? rateInfo.color : D.text;
      setFont(doc, ci === 0 || ci === 4 ? 'bold' : 'normal', 8.2, color);
      doc.text(fitPDFText(doc, value, col.width - 14), tx, rowY + 16, { align });
      cellX += col.width;
    });
  };

  let currentY = y;
  if (rows.length > 0) {
    drawHeader(currentY);
    currentY += headerH;
    rows.forEach((row, idx) => {
      if (currentY + rowH + noteH > PAGE_BOT) {
        doc.addPage();
        drawDashboardHeader(doc, {
          logoB64: headerCtx.logoB64 || null,
          period: headerCtx.period || period,
          dateStr: headerCtx.dateStr || '',
        });
        currentY = 66;
        drawHeader(currentY);
        currentY += headerH;
      }
      drawRow(currentY, row, idx);
      currentY += rowH;
    });
  } else {
    drawHeader(currentY);
    currentY += headerH;
    doc.setFillColor(...D.surface);
    doc.rect(ML, currentY, CW, rowH, 'F');
    doc.setDrawColor(...D.line);
    doc.setLineWidth(0.5);
    doc.line(ML, currentY + rowH, ML + CW, currentY + rowH);
    setFont(doc, 'normal', 8.2, D.textMuted);
    doc.text('No trend data available', ML + 8, currentY + 16);
    currentY += rowH;
  }

  if (currentY + noteH > PAGE_BOT) {
    doc.addPage();
    drawDashboardHeader(doc, {
      logoB64: headerCtx.logoB64 || null,
      period: headerCtx.period || period,
      dateStr: headerCtx.dateStr || '',
    });
    currentY = 66;
  }

  const noteY = currentY + 6;
  doc.setFillColor(13, 31, 60);
  doc.roundedRect(ML, noteY, CW, noteH, 4, 4, 'F');
  doc.setDrawColor(...D.line);
  doc.roundedRect(ML, noteY, CW, noteH, 4, 4, 'S');
  setFont(doc, 'bold', 7.5, D.blue);
  doc.text('Formula:', ML + 12, noteY + 12);
  setFont(doc, 'normal', 7.5, D.textMuted);
  doc.text('Savings Rate = (AVG. SAVINGS / AVG. INCOME) * 100', ML + 52, noteY + 10, { maxWidth: CW - 64 });
  doc.text('Shown as "Deficit" when income is zero but expenses are recorded.', ML + 52, noteY + 19, { maxWidth: CW - 64 });

  return noteY + noteH + 8;
};

const drawDashboardSavings = (doc, y, savingsDist) => {
  y = drawDashboardSectionTitle(doc, y, 'Savings Distribution');
  const rows = Array.isArray(savingsDist) ? savingsDist.filter((d) => Number(d.value || 0) > 0) : [];
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const headerH = 24;
  const rowH = 28;
  const totalH = headerH + rowH * (Math.max(rows.length, 1) + 1);
  if (y + totalH > PH - 62) return null;

  doc.setFillColor(...D.blueDark);
  doc.rect(ML, y, CW, headerH, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.9);
  doc.rect(ML, y, CW, totalH, 'S');

  const cols = [
    { label: 'CLASSIFICATION', width: CW * 0.34, align: 'left' },
    { label: 'USER COUNT', width: CW * 0.18, align: 'right' },
    { label: 'SHARE', width: CW * 0.28, align: 'left' },
    { label: 'STATUS', width: CW * 0.20, align: 'center' },
  ];
  let x = ML;
  cols.forEach((col) => {
    setFont(doc, 'bold', 8.2, D.surface);
    const tx = col.align === 'right' ? x + col.width - 8 : col.align === 'center' ? x + col.width / 2 : x + 8;
    doc.text(col.label, tx, y + 16, { align: col.align });
    x += col.width;
  });

  rows.forEach((row, idx) => {
    const rowY = y + headerH + idx * rowH;
    const bg = idx % 2 === 0 ? D.surface : D.surfaceAlt;
    doc.setFillColor(...bg);
    doc.rect(ML, rowY, CW, rowH, 'F');
    doc.setDrawColor(...D.line);
    doc.setLineWidth(0.5);
    doc.line(ML, rowY + rowH, ML + CW, rowY + rowH);

    const share = total > 0 ? (Number(row.value || 0) / total) * 100 : 0;
    const classification = String(row.classification || row.name || '').trim();
    const status = classification === 'Deficit'
      ? { text: 'Deficit', bg: [127, 29, 29], tc: [252, 165, 165], border: [153, 27, 27] }
      : classification === 'Moderate'
        ? { text: 'Moderate', bg: [120, 53, 15], tc: [252, 211, 77], border: [146, 64, 14] }
        : classification === 'High (>50%)'
          ? { text: 'High', bg: [20, 83, 45], tc: [134, 239, 172], border: [22, 101, 52] }
          : classification === 'TOTAL'
            ? { text: 'Total', bg: [30, 58, 95], tc: [147, 197, 253], border: [30, 58, 95] }
            : { text: 'Moderate', bg: [120, 53, 15], tc: [252, 211, 77], border: [146, 64, 14] };

    let cellX = ML;
    setFont(doc, 'bold', 8.3, D.text);
    doc.text(fitPDFText(doc, row.name, cols[0].width - 14), cellX + 8, rowY + 18);
    cellX += cols[0].width;
    setFont(doc, 'bold', 8.3, D.text);
    doc.text(String(row.value), cellX + cols[1].width - 8, rowY + 18, { align: 'right' });
    cellX += cols[1].width;

    const barX = cellX + 8;
    const barY = rowY + 9;
    const barW = cols[2].width - 18;
    doc.setFillColor(30, 58, 95);
    doc.roundedRect(barX, barY, barW, 10, 4, 4, 'F');
    doc.setFillColor(...(row.name === 'Negative Saver' ? [239, 68, 68] : row.name === 'High Saver' ? [34, 197, 94] : [234, 179, 8]));
    doc.roundedRect(barX, barY, Math.max(10, Math.round(barW * Math.min(Math.max(share, 0), 100) / 100)), 10, 4, 4, 'F');
    setFont(doc, 'bold', 7.9, D.textMuted);
    doc.text(`${share.toFixed(1)}%`, barX + barW + 4, rowY + 18);
    cellX += cols[2].width;

    drawDashboardPill(doc, {
      x: cellX + (cols[3].width - 64) / 2,
      y: rowY + 7,
      w: 64,
      h: 14,
      text: status.text,
      bg: status.bg,
      tc: status.tc,
      border: status.border,
      fontSize: 7.2,
    });
  });
  const totalRowY = y + headerH + rows.length * rowH;
  doc.setFillColor(...D.surface);
  doc.rect(ML, totalRowY, CW, rowH, 'F');
  doc.setDrawColor(...D.line);
  doc.line(ML, totalRowY, ML + CW, totalRowY);
  setFont(doc, 'bold', 8.3, D.text);
  doc.text('TOTAL', ML + 8, totalRowY + 18);
  doc.text(String(total), ML + cols[0].width + cols[1].width - 8, totalRowY + 18, { align: 'right' });
  const totalBarX = ML + cols[0].width + cols[1].width + 8;
  const totalBarW = cols[2].width - 18;
  doc.setFillColor(30, 58, 95);
  doc.roundedRect(totalBarX, totalRowY + 9, totalBarW, 10, 4, 4, 'F');
  doc.setFillColor(...D.green);
  doc.roundedRect(totalBarX, totalRowY + 9, totalBarW, 10, 4, 4, 'F');
  drawDashboardPill(doc, {
    x: ML + cols[0].width + cols[1].width + cols[2].width + (cols[3].width - 48) / 2,
    y: totalRowY + 7,
    w: 48,
    h: 14,
    text: 'Total',
    bg: [30, 58, 95],
    tc: [147, 197, 253],
    border: [30, 58, 95],
    fontSize: 7.1,
  });
  setFont(doc, 'bold', 7.9, D.textMuted);
  doc.text('100.0%', totalBarX + totalBarW + 4, totalRowY + 18);

  return y + totalH + 12;
};

const drawDashboardCategories = (doc, y, categories) => {
  const rows = Array.isArray(categories) ? categories.slice(0, 6) : [];
  const total = rows.reduce((sum, row) => sum + Number(row.total_spent || 0), 0);
  const headerH = 54;
  const rowH = 34;
  const noteH = 26;
  const totalH = headerH + rowH * Math.max(rows.length, 1) + noteH + 10;
  if (y + totalH > PH - 62) return null;

  doc.setFillColor(...D.surface);
  doc.roundedRect(ML, y, CW, totalH, 14, 14, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.9);
  doc.roundedRect(ML, y, CW, totalH, 14, 14, 'S');
  doc.setFillColor(...D.redSoft);
  doc.roundedRect(ML + 16, y + 12, 28, 28, 8, 8, 'F');
  doc.setDrawColor(...D.red);
  doc.setLineWidth(0.9);
  doc.roundedRect(ML + 16, y + 12, 28, 28, 8, 8, 'S');
  setFont(doc, 'bold', 12, D.red);
  doc.text('↓', ML + 30, y + 30, { align: 'center' });
  setFont(doc, 'bold', 14, D.text);
  doc.text('Top Spending Categories', ML + 56, y + 28);
  setFont(doc, 'normal', 8.5, D.textMuted);
  doc.text('Share of total spend per category', ML + 56, y + 39);
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.7);
  doc.line(ML + 16, y + headerH, ML + CW - 16, y + headerH);

  rows.forEach((row, idx) => {
    const rowY = y + headerH + idx * rowH;
    const share = total > 0 ? (Number(row.total_spent || 0) / total) * 100 : 0;
    const hex = String(row.color_hex || '#2563eb');
    const color = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const status = ['Bills & Utilities', 'Food & Dining', 'Transportation'].includes(row.category)
      ? { text: 'Caution', bg: D.amberSoft, tc: D.amberDark }
      : row.category === 'Shopping'
        ? { text: 'Normal', bg: D.surfaceSoft, tc: D.textMuted }
        : row.category === 'Health'
          ? { text: 'Normal', bg: D.greenSoft, tc: D.greenDark }
          : { text: 'Normal', bg: D.blueSoft, tc: D.blueDark };

    const label = share <= 0 ? 'No data yet' : row.category;
    const labelColor = share <= 0 ? D.textMuted : D.text;
    const barX = ML + 16;
    const barW = CW - 32;

    doc.setFillColor(...D.surfaceAlt);
    doc.roundedRect(barX, rowY + 10, barW, 6, 99, 99, 'F');
    doc.setFillColor(...color);
    doc.roundedRect(barX, rowY + 10, Math.max(0, Math.round(barW * Math.min(Math.max(share, 0), 100) / 100)), 6, 99, 99, 'F');

    doc.setFillColor(...color);
    doc.circle(barX + 4, rowY + 2, 4, 'F');
    setFont(doc, 'bold', 8.7, labelColor);
    doc.text(fitPDFText(doc, label, 122), barX + 16, rowY + 5);

    if (share > 0) {
      drawDashboardPill(doc, {
        x: barX + 128,
        y: rowY - 4,
        w: 48,
        h: 14,
        text: status.text,
        bg: status.bg,
        tc: status.tc,
        border: status.bg,
        fontSize: 7.1,
      });
    } else {
      drawDashboardPill(doc, {
        x: barX + 128,
        y: rowY - 4,
        w: 58,
        h: 14,
        text: 'No data yet',
        bg: D.surfaceAlt,
        tc: D.textMuted,
        border: D.line,
        fontSize: 7,
      });
    }

    setFont(doc, 'bold', 9, share > 0 ? color : D.textMuted);
    doc.text(`${share.toFixed(0)}%`, ML + CW - 18, rowY + 5, { align: 'right' });
  });

  const noteY = y + headerH + rowH * Math.max(rows.length, 1) + 2;
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.7);
  doc.line(ML + 16, noteY, ML + CW - 16, noteY);
  setFont(doc, 'normal', 7.6, D.textMuted);
  doc.text(
    'Calculation: share % = category total spend ÷ total spend of top categories × 100. Status: Caution for Bills/Food/Transportation, Normal for Shopping/Health/Entertainment.',
    ML + 18,
    noteY + 12
  );

  return y + totalH + 4;
};

const drawDashboardCategoriesExact = (doc, y, categories) => {
  const source = Array.isArray(categories) ? categories : [];
  const order = ['Bills & Utilities', 'Food & Dining', 'Shopping', 'Transportation', 'Health', 'Entertainment', 'Groceries'];
  const palette = {
    'Bills & Utilities': [239, 68, 68],
    'Food & Dining': [249, 115, 22],
    'Shopping': [245, 158, 11],
    'Transportation': [245, 158, 11],
    'Health': [34, 197, 94],
    'Entertainment': [59, 130, 246],
    'Groceries': [148, 163, 184],
  };
  const byName = new Map(source.map((row) => [String(row.category || '').trim(), row]));
  const rows = order.map((name) => byName.get(name) || ({ category: name, total_spent: 0, color_hex: '#94a3b8' }));
  const total = rows.reduce((sum, row) => sum + Number(row.total_spent || 0), 0);
  const rowH = 28;
  const headerH = 56;
  const calcH = 92;
  const totalH = headerH + rows.length * rowH + calcH + 8;
  if (y + totalH > PH - 62) return null;

  doc.setFillColor(...D.surface);
  doc.roundedRect(ML, y, CW, totalH, 14, 14, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.9);
  doc.roundedRect(ML, y, CW, totalH, 14, 14, 'S');
  doc.setFillColor(...D.redSoft);
  doc.roundedRect(ML + 16, y + 12, 30, 30, 8, 8, 'F');
  doc.setDrawColor(...D.red);
  doc.roundedRect(ML + 16, y + 12, 30, 30, 8, 8, 'S');
  setFont(doc, 'bold', 12, D.red);
  doc.text('•', ML + 31, y + 31, { align: 'center' });
  setFont(doc, 'bold', 14, D.text);
  doc.text('Top Spending Categories', ML + 58, y + 28);
  setFont(doc, 'normal', 8.5, D.textMuted);
  doc.text('Share of total spend per category', ML + 58, y + 39);
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.7);
  doc.line(ML + 16, y + headerH, ML + CW - 16, y + headerH);

  rows.forEach((row, idx) => {
    const rowY = y + headerH + idx * rowH;
    const value = Number(row.total_spent || 0);
    const share = total > 0 ? (value / total) * 100 : 0;
    const color = palette[row.category] || [37, 99, 235];
    const isNoData = row.category === 'Groceries' || value <= 0;
    const status = isNoData
      ? { text: 'No data yet', bg: [241, 245, 249], tc: [148, 163, 184], w: 58 }
      : ['Bills & Utilities', 'Food & Dining'].includes(row.category)
        ? { text: 'Caution', bg: [254, 243, 199], tc: [217, 119, 6], w: 48 }
        : { text: 'Normal', bg: [241, 245, 249], tc: [100, 116, 139], w: 48 };

    doc.setFillColor(...D.surfaceAlt);
    doc.roundedRect(ML + 16, rowY + 12, CW - 32, 6, 3, 3, 'F');
    if (!isNoData) {
      doc.setFillColor(...color);
      doc.roundedRect(ML + 16, rowY + 12, Math.max(10, Math.round((CW - 32) * (share / 100))), 6, 3, 3, 'F');
    }
    doc.setFillColor(...color);
    doc.circle(ML + 20, rowY + 2, 4, 'F');
    setFont(doc, 'bold', 8.7, D.text);
    doc.text(fitPDFText(doc, row.category, 120), ML + 32, rowY + 5);

    drawDashboardPill(doc, {
      x: ML + 130,
      y: rowY - 4,
      w: status.w,
      h: 14,
      text: status.text,
      bg: status.bg,
      tc: status.tc,
      border: status.bg,
      fontSize: status.text === 'No data yet' ? 7 : 7.1,
    });
    setFont(doc, 'bold', 14, color);
    doc.text(`${Math.round(share)}%`, ML + CW - 18, rowY + 5, { align: 'right' });
  });

  const calcY = y + headerH + rows.length * rowH + 8;
  doc.setFillColor(13, 31, 60);
  doc.rect(ML, calcY, CW, calcH, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.7);
  doc.line(ML, calcY, ML + CW, calcY);
  setFont(doc, 'bold', 8.5, D.text);
  doc.text('CALCULATION FORMULA', ML + 16, calcY + 14);
  setFont(doc, 'normal', 7.8, D.textMuted);
  doc.text('Share (%) = Category Spend / Total Spend * 100', ML + 16, calcY + 28);
  const example = rows.find((r) => r.category === 'Bills & Utilities');
  if (example && total > 0) {
    doc.text(`Example: ${fmtPDF(example.total_spent)} / ${fmtPDF(total)} * 100 = ${Math.round((Number(example.total_spent || 0) / total) * 100)}%`, ML + 16, calcY + 42);
  }
  doc.text(`Total Tracked Spend = ${fmtPDF(total)}`, ML + 16, calcY + 56);
  doc.text('Status: Caution = share >= 25% | Normal = share < 25% | No data = PHP 0 recorded spend', ML + 16, calcY + 70, { maxWidth: CW - 32 });

  return y + totalH + 4;
};

const drawDashboardCategoriesDark = (doc, y, categories) => {
  const source = Array.isArray(categories) ? categories : [];
  const order = ['Bills & Utilities', 'Food & Dining', 'Shopping', 'Transportation', 'Health', 'Entertainment', 'Groceries'];
  const palette = {
    'Bills & Utilities': [239, 68, 68],
    'Food & Dining': [249, 115, 22],
    'Shopping': [245, 158, 11],
    'Transportation': [245, 158, 11],
    'Health': [34, 197, 94],
    'Entertainment': [59, 130, 246],
    'Groceries': [71, 85, 105],
  };
  const byName = new Map(source.map((row) => [String(row.category || '').trim(), row]));
  const rows = order.map((name) => byName.get(name) || ({ category: name, total_spent: 0, color_hex: '#475569' }));
  const total = rows.reduce((sum, row) => sum + Number(row.total_spent || 0), 0);
  const rowH = 30;
  const headerH = 58;
  const calcH = 86;
  const totalH = headerH + rows.length * rowH + calcH + 8;
  if (y + totalH > PH - 62) return null;

  doc.setFillColor(...D.surface);
  doc.roundedRect(ML, y, CW, totalH, 14, 14, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.9);
  doc.roundedRect(ML, y, CW, totalH, 14, 14, 'S');
  doc.setFillColor(...D.redSoft);
  doc.roundedRect(ML + 16, y + 12, 30, 30, 8, 8, 'F');
  doc.setDrawColor(...D.red);
  doc.roundedRect(ML + 16, y + 12, 30, 30, 8, 8, 'S');
  setFont(doc, 'bold', 12, D.red);
  doc.text('•', ML + 31, y + 31, { align: 'center' });
  setFont(doc, 'bold', 14, D.text);
  doc.text('Top Spending Categories', ML + 58, y + 28);
  setFont(doc, 'normal', 8.5, D.textMuted);
  doc.text('Share of total spend per category', ML + 58, y + 39);
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.7);
  doc.line(ML + 16, y + headerH, ML + CW - 16, y + headerH);

  rows.forEach((row, idx) => {
    const rowY = y + headerH + idx * rowH;
    const value = Number(row.total_spent || 0);
    const share = total > 0 ? (value / total) * 100 : 0;
    const color = palette[row.category] || [71, 85, 105];
    const isNoData = row.category === 'Groceries' || value <= 0;
    const status = isNoData
      ? { text: 'No data yet', bg: [30, 41, 59], tc: [100, 116, 139], w: 58 }
      : ['Bills & Utilities', 'Food & Dining'].includes(row.category)
        ? { text: 'Caution', bg: [120, 53, 15], tc: [252, 211, 77], w: 48 }
        : { text: 'Normal', bg: [30, 58, 95], tc: [147, 197, 253], w: 48 };

    doc.setFillColor(30, 58, 95);
    doc.roundedRect(ML + 16, rowY + 12, CW - 32, 5, 3, 3, 'F');
    if (!isNoData) {
      doc.setFillColor(...color);
      doc.roundedRect(ML + 16, rowY + 12, Math.max(10, Math.round((CW - 32) * (share / 100))), 5, 3, 3, 'F');
    }
    doc.setFillColor(...color);
    doc.circle(ML + 20, rowY + 2, 4, 'F');
    setFont(doc, 'bold', 8.7, D.text);
    doc.text(fitPDFText(doc, row.category, 120), ML + 32, rowY + 5);

    drawDashboardPill(doc, {
      x: ML + 130,
      y: rowY - 4,
      w: status.w,
      h: 14,
      text: status.text,
      bg: status.bg,
      tc: status.tc,
      border: status.bg,
      fontSize: status.text === 'No data yet' ? 7 : 7.1,
    });
    setFont(doc, 'bold', 14, color);
    doc.text(`${Math.round(share)}%`, ML + CW - 18, rowY + 5, { align: 'right' });
  });

  const calcY = y + headerH + rows.length * rowH + 8;
  doc.setFillColor(13, 31, 60);
  doc.rect(ML, calcY, CW, calcH, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.7);
  doc.line(ML, calcY, ML + CW, calcY);
  setFont(doc, 'bold', 8.5, D.text);
  doc.text('CALCULATION FORMULA', ML + 16, calcY + 14);
  setFont(doc, 'normal', 7.8, D.textMuted);
  doc.text('Share (%) = Category Spend / Total Spend * 100', ML + 16, calcY + 28);
  const example = rows.find((r) => r.category === 'Bills & Utilities');
  if (example && total > 0) {
    doc.text(`Example: ${fmtPDF(example.total_spent)} / ${fmtPDF(total)} * 100 = ${Math.round((Number(example.total_spent || 0) / total) * 100)}%`, ML + 16, calcY + 42);
  }
  doc.text(`Total Tracked Spend = ${fmtPDF(total)}`, ML + 16, calcY + 56);
  doc.text('Status: Caution = share >= 25% | Normal = share < 25% | No data = PHP 0 recorded spend', ML + 16, calcY + 70, { maxWidth: CW - 32 });

  return y + totalH + 4;
};

const drawDashboardRisk = (doc, y, users, headerCtx = {}) => {
  y = drawDashboardSectionTitle(doc, y, 'Risk Users Table');
  const list = Array.isArray(users) ? [...users] : [];
  if (list.length === 0) return y;

  const counts = {
    High: list.filter((u) => u.risk_level === 'High').length,
    Medium: list.filter((u) => u.risk_level === 'Medium').length,
    Low: list.filter((u) => u.risk_level === 'Low').length,
  };

  const boxW = (CW - 16) / 3;
  const boxH = 42;
  [
    { label: `${counts.High} High`, bg: [127, 29, 29], tc: [252, 165, 165], border: [153, 27, 27] },
    { label: `${counts.Medium} Medium`, bg: [120, 53, 15], tc: [252, 211, 77], border: [146, 64, 14] },
    { label: `${counts.Low} Low`, bg: [20, 83, 45], tc: [134, 239, 172], border: [22, 101, 52] },
  ].forEach((box, idx) => {
    const x = ML + idx * (boxW + 8);
    doc.setFillColor(...box.bg);
    doc.roundedRect(x, y, boxW, boxH, 10, 10, 'F');
    doc.setDrawColor(...box.tc);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, boxW, boxH, 10, 10, 'S');
    setFont(doc, 'bold', 12, box.tc);
    doc.text(box.label, x + boxW / 2, y + 25, { align: 'center' });
  });

  y += boxH + 12;

  const cols = [
    { label: 'AVATAR', width: 48, align: 'center' },
    { label: 'NAME', width: 118, align: 'left' },
    { label: 'EMAIL', width: 150, align: 'left' },
    { label: 'AVG INCOME', width: 70, align: 'right' },
    { label: 'AVG EXPENSES', width: 74, align: 'right' },
    { label: 'EXP. RATIO', width: 52, align: 'right' },
    { label: 'RISK LEVEL', width: 61, align: 'center' },
  ];
  const tableW = cols.reduce((sum, c) => sum + c.width, 0);
  const headerH = 24;
  const rowH = 30;
  const drawHeader = () => {
    doc.setFillColor(...D.blueDark);
    doc.rect(ML, y, tableW, headerH, 'F');
    doc.setDrawColor(...D.line);
    doc.setLineWidth(0.9);
    doc.rect(ML, y, tableW, headerH, 'S');
    let x = ML;
    cols.forEach((col) => {
      setFont(doc, 'bold', 7.8, D.surface);
      const tx = col.align === 'right' ? x + col.width - 8 : col.align === 'center' ? x + col.width / 2 : x + 8;
      doc.text(col.label, tx, y + 16, { align: col.align });
      x += col.width;
    });
  };

  const sortOrder = { High: 0, Medium: 1, Low: 2 };
  list.sort((a, b) => (sortOrder[a.risk_level] ?? 3) - (sortOrder[b.risk_level] ?? 3));

  drawHeader();
  y += headerH;

  list.forEach((user, idx) => {
    if (y + rowH > PH - 62) {
      doc.addPage();
      drawDashboardHeader(doc, {
        logoB64: headerCtx.logoB64 || null,
        period: headerCtx.period || 'Monthly',
        dateStr: headerCtx.dateStr || '',
      });
      y = 66;
      drawHeader();
      y += headerH;
    }

    const rowBg = idx % 2 === 0 ? D.surface : D.surfaceAlt;
    doc.setFillColor(...rowBg);
    doc.rect(ML, y, tableW, rowH, 'F');
    doc.setDrawColor(...D.line);
    doc.setLineWidth(0.5);
    doc.line(ML, y + rowH, ML + tableW, y + rowH);

    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.full_name || '-';
    const initials = [user.first_name, user.last_name]
      .filter(Boolean)
      .map((part) => String(part).trim().charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || 'U';
    const ratio = Number(user.expense_ratio) || 0;
    const ratioColor = expRatioColor(ratio);
    const risk = String(user.risk_level || 'Low').toUpperCase();
    const riskCfg = risk === 'HIGH'
      ? { bg: [127, 29, 29], tc: [252, 165, 165], border: [153, 27, 27] }
      : risk === 'MEDIUM'
        ? { bg: [120, 53, 15], tc: [252, 211, 77], border: [146, 64, 14] }
        : { bg: [20, 83, 45], tc: [134, 239, 172], border: [22, 101, 52] };
    const avatarFill = risk === 'HIGH'
      ? [239, 68, 68]
      : risk === 'MEDIUM'
        ? [217, 119, 6]
        : [22, 163, 74];

    let x = ML;
    doc.setFillColor(...avatarFill);
    doc.circle(x + 24, y + 15, 10, 'F');
    setFont(doc, 'bold', 8, D.white || [255, 255, 255]);
    doc.text(initials, x + 24, y + 17, { align: 'center' });
    x += cols[0].width;

    setFont(doc, 'bold', 8.5, D.text);
    doc.text(fitPDFText(doc, fullName, cols[1].width - 14), x + 8, y + 17);
    x += cols[1].width;

    setFont(doc, 'normal', 8.1, D.textMuted);
    doc.text(fitPDFText(doc, String(user.email || '-'), cols[2].width - 14), x + 8, y + 17);
    x += cols[2].width;

    setFont(doc, 'normal', 8.1, D.text);
    doc.text(fitPDFText(doc, fmtPDF(user.total_income), cols[3].width - 14), x + cols[3].width - 8, y + 17, { align: 'right' });
    x += cols[3].width;

    setFont(doc, 'normal', 8.1, D.text);
    doc.text(fitPDFText(doc, fmtPDF(user.total_expenses), cols[4].width - 14), x + cols[4].width - 8, y + 17, { align: 'right' });
    x += cols[4].width;

    setFont(doc, 'bold', 8.4, ratioColor);
    doc.text(`${Number.isFinite(ratio) ? ratio.toFixed(1) : '0.0'}%`, x + cols[5].width - 8, y + 17, { align: 'right' });
    x += cols[5].width;

    drawDashboardPill(doc, {
      x: x + (cols[6].width - 50) / 2,
      y: y + 8,
      w: 50,
      h: 14,
      text: risk,
      bg: riskCfg.bg,
      tc: riskCfg.tc,
      border: riskCfg.border,
      fontSize: 7.1,
    });

    y += rowH;
  });

  let noteY = y + 6;
  const noteH = 126;
  if (noteY + noteH > PH - 62) {
    doc.addPage();
    drawDashboardHeader(doc, {
      logoB64: headerCtx.logoB64 || null,
      period: headerCtx.period || 'Monthly',
      dateStr: headerCtx.dateStr || '',
    });
    noteY = 72;
  }

  doc.setFillColor(13, 31, 60);
  doc.rect(ML, noteY, CW, noteH, 'F');
  doc.setDrawColor(...D.line);
  doc.setLineWidth(0.7);
  doc.line(ML, noteY, ML + CW, noteY);

  setFont(doc, 'bold', 10, [147, 197, 253]);
  doc.text("EXPENSE RATIO - HOW IT'S CALCULATED", ML + 16, noteY + 14);

  setFont(doc, 'bold', 9.5, [147, 197, 253]);
  doc.text('Formula:', ML + 16, noteY + 29);
  setFont(doc, 'normal', 9.5, D.text);
  doc.text('Expense Ratio (%) = (Avg. Expenses / Avg. Income) * 100', ML + 72, noteY + 29, { maxWidth: CW - 88 });

  const topUser = list[0];
  if (topUser) {
    const topInc = Number(topUser.total_income || 0);
    const topExp = Number(topUser.total_expenses || 0);
    const topRatio = topInc > 0 ? (topExp / topInc) * 100 : 0;
    const topName = [topUser.first_name, topUser.last_name].filter(Boolean).join(' ') || topUser.full_name || 'Top User';
    setFont(doc, 'normal', 9, D.textMuted);
    doc.text(`Example - ${topName} (highest risk):`, ML + 16, noteY + 44);
    doc.text(`${fmtPDF(topExp)} / ${fmtPDF(topInc)} * 100 = ${topRatio.toFixed(1)}%`, ML + 16, noteY + 56);
    doc.text('-> Expenses are 254% of income = critically over budget', ML + 16, noteY + 68);
  }

  setFont(doc, 'bold', 9.5, [147, 197, 253]);
  doc.text('Risk Level Thresholds:', ML + 16, noteY + 84);
  setFont(doc, 'bold', 9, [252, 165, 165]);
  doc.text('HIGH', ML + 16, noteY + 98);
  setFont(doc, 'normal', 9, D.textMuted);
  doc.text('>= 80%   -> Expenses far exceed or exceed income', ML + 58, noteY + 98);
  setFont(doc, 'bold', 9, [252, 211, 77]);
  doc.text('MEDIUM', ML + 16, noteY + 112);
  setFont(doc, 'normal', 9, D.textMuted);
  doc.text('50-79%   -> Expenses consuming most of income', ML + 58, noteY + 112);
  setFont(doc, 'bold', 9, [134, 239, 172]);
  doc.text('LOW', ML + 16, noteY + 126);
  setFont(doc, 'normal', 9, D.textMuted);
  doc.text('< 50%   -> Healthy spending, good savings buffer', ML + 58, noteY + 126);

  y = noteY + noteH;

  return y + 8;
};


const fitPDFText = (doc, value, maxWidth) => {
  const text = String(value ?? '');
  if (!text || maxWidth <= 0) return '';
  if (doc.getTextWidth(text) <= maxWidth) return text;

  const ellipsis = '...';
  let trimmed = text;
  while (trimmed.length > 0 && doc.getTextWidth(trimmed + ellipsis) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? trimmed + ellipsis : ellipsis;
};

const guard = (doc, cur, need = 50, dateStr = '', period = '') => {
  if (cur.y + need > PAGE_BOT) {
    doc.addPage();
    drawPageHeader(doc, { dateStr, period });
    cur.y = PAGE_TOP + 6;
    return true;
  }
  return false;
};

export const makeCur = (start = 0) => {
  let y = start;
  return {
    get y() {
      return y;
    },
    set y(v) {
      y = v;
    },
    adv(n) {
      y += n;
    }
  };
};
export const fmtPDF = (v) => {
  const n = Number(v);
  if ((!v && v !== 0) || isNaN(n)) return '-';
  if (n >= 1_000_000) return 'PHP ' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return 'PHP ' + (n / 1_000).toFixed(1) + 'k';
  return 'PHP ' + n.toFixed(0);
};

/* ── Pill helpers ────────────────────────────────────────────── */
const pill = (text, bgColor, textColor) => ({ __pill: true, text, bgColor, textColor });

export const riskPill = (level) => {
  const map = { High: { bg: C.redLt, tc: C.red }, Medium: { bg: C.amberLt, tc: C.amber }, Low: { bg: C.greenLt, tc: C.green } };
  const { bg, tc } = map[level] || { bg: C.offWhite, tc: C.textMid };
  return pill(level, bg, tc);
};

export const saverPill = (name) => {
  const map = { 'Negative Saver': { bg: C.redLt, tc: C.red }, 'Low Saver': { bg: C.amberLt, tc: C.amber }, 'Mid Saver': { bg: C.indigoLt, tc: C.indigo }, 'High Saver': { bg: C.greenLt, tc: C.green } };
  const { bg, tc } = map[name] || { bg: C.offWhite, tc: C.textMid };
  return pill(name, bg, tc);
};

export const spendPill = (status) => {
  const map = { 'Over Limit': { bg: C.redLt, tc: C.red }, 'Caution': { bg: C.amberLt, tc: C.amber }, 'Normal': { bg: C.greenLt, tc: C.green } };
  const { bg, tc } = map[status] || { bg: C.offWhite, tc: C.textMid };
  return pill(status, bg, tc);
};

/* ══════════════════════════════════════════════════════════════
   DRAW FUNCTIONS
══════════════════════════════════════════════════════════════ */
const drawPageHeader = (doc, { dateStr, period }) => {
  doc.setFillColor(...C.navyDark);
  doc.rect(0, 0, PW, 30, 'F');
  doc.setFillColor(...C.teal);
  doc.rect(0, 28, PW, 2.5, 'F');
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, 5, 30, 'F');
  setFont(doc, 'bold', 9, [185, 215, 255]);
  doc.text('PESO AI  ·  Admin Analytics Report', ML + 8, 19);
  setFont(doc, 'normal', 7.5, [120, 160, 210]);
  doc.text(`${period} Period  ·  ${dateStr}`, PW - MR, 19, { align: 'right' });
};

const drawCoverPage = (doc, { dateStr, timeStr, logoB64, period, selected, dashboardData }) => {
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, PH, 'F');
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, 8, PH, 'F');
  doc.setFillColor(...C.teal);
  doc.rect(0, PH - 6, PW, 6, 'F');
  doc.setFillColor(...C.teal);
  doc.rect(0, 0, PW, 4, 'F');

  if (logoB64) {
    try { doc.addImage(logoB64, 'PNG', ML + 10, 60, 70, 70); } catch (_) {}
  }

  const tx = ML + (logoB64 ? 96 : 20);
  setFont(doc, 'bold', 32, C.white);
  doc.text('PESO AI', tx, 95);
  doc.setDrawColor(...C.teal);
  doc.setLineWidth(2);
  doc.line(tx, 104, tx + 160, 104);
  setFont(doc, 'bold', 14, [185, 220, 255]);
  doc.text('Admin Analytics Report', tx, 122);
  setFont(doc, 'normal', 9, [140, 180, 230]);
  doc.text('Tabular Summary  ·  All financial metrics in structured table format', tx, 138);

  const bx = ML + 20, by = 185, bw = CW - 40, bh = 130;
  doc.setFillColor(25, 50, 100);
  doc.roundedRect(bx, by, bw, bh, 8, 8, 'F');
  doc.setDrawColor(...C.teal);
  doc.setLineWidth(1.5);
  doc.roundedRect(bx, by, bw, bh, 8, 8, 'S');
  doc.setFillColor(...C.teal);
  doc.roundedRect(bx, by, 6, bh, 4, 4, 'F');

  setFont(doc, 'bold', 8, [140, 200, 220]);
  doc.text('REPORT DETAILS', bx + 24, by + 22);

  const infoRows = [
    ['Generated On',  dateStr],
    ['Time',          timeStr],
    ['Period Filter', period],
    ['Sections',      selected.map(s => ({ kpis: 'KPIs', trend: 'Trend', savings: 'Savings', categories: 'Categories', risk: 'Risk Users' })[s] || s).join('  ·  ')],
    ['Total Users',   String(dashboardData.kpis?.total_users ?? '-')],
  ];
  infoRows.forEach(([label, value], i) => {
    const ry = by + 38 + i * 18;
    setFont(doc, 'normal', 8, [120, 165, 215]);
    doc.text(label, bx + 24, ry);
    setFont(doc, 'bold', 8.5, C.white);
    doc.text(value, bx + 130, ry);
  });

  const sx = ML + 20, sy = 345;
  setFont(doc, 'bold', 8, [140, 200, 220]);
  doc.text('SECTIONS INCLUDED IN THIS REPORT', sx, sy);
  doc.setDrawColor(...C.teal);
  doc.setLineWidth(0.5);
  doc.line(sx, sy + 4, sx + 220, sy + 4);

  const sectionLabels = {
    kpis:       '01  KEY PERFORMANCE INDICATORS',
    trend:      '02  FINANCIAL TREND TABLE',
    savings:    '03  SAVINGS DISTRIBUTION',
    categories: '04  TOP SPENDING CATEGORIES',
    risk:       '05  RISK USERS TABLE',
  };
  selected.forEach((sid, i) => {
    const label = sectionLabels[sid] || sid.toUpperCase();
    const col   = i % 2;
    const row   = Math.floor(i / 2);
    const ix    = sx + col * 260;
    const iy    = sy + 20 + row * 26;
    doc.setFillColor(...C.teal);
    doc.circle(ix + 4, iy - 3, 3, 'F');
    setFont(doc, 'bold', 8.5, C.white);
    doc.text(label, ix + 14, iy);
  });

  setFont(doc, 'bold', 8, [60, 100, 160]);
  doc.text('CONFIDENTIAL  ·  FOR INTERNAL USE ONLY', PW / 2, PH - 30, { align: 'center' });
  setFont(doc, 'normal', 7, [50, 85, 140]);
  doc.text('Generated by PESO AI Admin System  ·  ' + dateStr, PW / 2, PH - 18, { align: 'center' });
};

const drawSection = (doc, cur, text, ctx = {}) => {
  guard(doc, cur, SECTION_H + HDR_H + ROW_H * 2, ctx.dateStr, ctx.period);
  doc.setFillColor(...C.navy);
  doc.rect(ML, cur.y, CW, SECTION_H, 'F');
  doc.setFillColor(...C.teal);
  doc.rect(ML, cur.y, 5, SECTION_H, 'F');
  setFont(doc, 'bold', 9.5, C.white);
  doc.text(text.toUpperCase(), ML + 16, cur.y + SECTION_H - 9);
  cur.adv(SECTION_H + 6);
};

const drawTable = (doc, cur, cols, rows, opts = {}) => {
  const { accentColors = null, headerBg = C.navyDark, headerText = C.white, zebra = true, ctx = {} } = opts;
  const { dateStr = '', period = '' } = ctx;

  const drawHdr = () => {
    if (cur.y + HDR_H + ROW_H * 2 > PAGE_BOT) {
      doc.addPage();
      drawPageHeader(doc, { dateStr, period });
      cur.y = PAGE_TOP + 6;
    }
    doc.setFillColor(...headerBg);
    doc.rect(ML, cur.y, CW, HDR_H, 'F');
    doc.setFillColor(...C.teal);
    doc.rect(ML, cur.y, 5, HDR_H, 'F');
    doc.setDrawColor(...C.teal);
    doc.setLineWidth(1.5);
    doc.line(ML, cur.y + HDR_H, ML + CW, cur.y + HDR_H);
    setFont(doc, 'bold', 8.5, headerText);
    let x = ML;
    cols.forEach(col => {
      const align = col.align || 'left';
      const tx = align === 'right' ? x + col.width - CELL_PAD : align === 'center' ? x + col.width / 2 : x + CELL_PAD + 6;
      doc.text(col.label, tx, cur.y + HDR_H - 7, { align });
      x += col.width;
    });
    cur.adv(HDR_H);
  };

  drawHdr();

  rows.forEach((row, idx) => {
    if (cur.y + ROW_H > PAGE_BOT) {
      doc.addPage();
      drawPageHeader(doc, { dateStr, period });
      cur.y = PAGE_TOP + 6;
      drawHdr();
    }
    const rowBg = zebra && idx % 2 === 1 ? C.stripe : C.white;
    doc.setFillColor(...rowBg);
    doc.rect(ML, cur.y, CW, ROW_H, 'F');
    if (accentColors && accentColors[idx]) {
      doc.setFillColor(...accentColors[idx]);
      doc.rect(ML, cur.y, 5, ROW_H, 'F');
    }
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.4);
    doc.line(ML, cur.y + ROW_H, ML + CW, cur.y + ROW_H);

    let x = ML;
    row.forEach((cell, ci) => {
      const col   = cols[ci];
      const align = col.align || 'left';
      const padX  = ci === 0 ? CELL_PAD + 6 : CELL_PAD;
      const tx = align === 'right' ? x + col.width - CELL_PAD : align === 'center' ? x + col.width / 2 : x + padX;

      if (cell && cell.__pill) {
        const { text: pt, bgColor, textColor } = cell;
        const pillW = Math.min(col.width - CELL_PAD * 2, 86);
        const pillH = 15;
        const pillX = align === 'center' ? x + (col.width - pillW) / 2 : align === 'right' ? x + col.width - CELL_PAD - pillW : x + padX;
        const pillY = cur.y + (ROW_H - pillH) / 2;
        doc.setFillColor(...bgColor);
        doc.roundedRect(pillX, pillY, pillW, pillH, 3, 3, 'F');
        doc.setDrawColor(...textColor);
        doc.setLineWidth(0.6);
        doc.roundedRect(pillX, pillY, pillW, pillH, 3, 3, 'S');
        setFont(doc, 'bold', 8, textColor);
        doc.text(pt, pillX + pillW / 2, pillY + pillH - 4, { align: 'center' });
        setFont(doc, 'normal', 9, C.textDark);
      } else if (cell !== '' && cell != null) {
        setFont(doc, ci === 0 ? 'bold' : 'normal', 9, C.textDark);
        doc.text(
          fitPDFText(doc, cell, col.width - CELL_PAD * 2),
          tx,
          cur.y + ROW_H - 7,
          { align }
        );
      }
      x += col.width;
    });
    cur.adv(ROW_H);
  });
  cur.adv(14);
};

const stampFooters = (doc, totalPages) => {
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFillColor(...C.navyDark);
    doc.rect(0, PH - 28, PW, 28, 'F');
    doc.setFillColor(...C.teal);
    doc.rect(0, PH - 28, PW, 2, 'F');
    setFont(doc, 'normal', 7.5, [140, 185, 230]);
    doc.text('PESO AI  ·  Admin Analytics Report  ·  Confidential', ML, PH - 10);
    setFont(doc, 'bold', 7.5, [180, 210, 255]);
    doc.text(`Page ${pg} of ${totalPages}`, PW - MR, PH - 10, { align: 'right' });
  }
};

/* ── jsPDF loader ────────────────────────────────────────────── */
const loadjsPDF = () => new Promise(resolve => {
  if (window.jspdf) { resolve(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload = resolve;
  document.head.appendChild(s);
});

const getPDFLogoBase64 = async (logoSrc) => {
  try {
    const res  = await fetch(logoSrc);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
};

/* ══════════════════════════════════════════════════════════════
   MAIN GENERATE PDF
══════════════════════════════════════════════════════════════ */
export const generatePDF = async (selected, dashboardData, logoSrc) => {
  await loadjsPDF();
  const logoB64 = await getPDFLogoBase64(logoSrc);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const cur = makeCur();

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const period  = (dashboardData.trendFilter || 'monthly').charAt(0).toUpperCase()
                + (dashboardData.trendFilter || 'monthly').slice(1);
  const selectedSections = Array.isArray(selected) ? selected : [];

  drawDashboardCover(doc, { logoB64, dateStr, timeStr, period, selected: selectedSections, dashboardData });

  doc.addPage();
  drawDashboardHeader(doc, { logoB64, period, dateStr });

  let y = 66;
  if (selectedSections.includes('kpis')) {
    y = drawDashboardKpis(doc, y, dashboardData);
  }

  if (selectedSections.includes('trend') && Array.isArray(dashboardData.trend) && dashboardData.trend.length > 0) {
    const nextY = drawDashboardTrend(doc, y, dashboardData.trend, period, { logoB64, period, dateStr });
    if (nextY == null) {
      doc.addPage();
      drawDashboardHeader(doc, { logoB64, period, dateStr });
      y = 66;
      y = drawDashboardTrend(doc, y, dashboardData.trend, period, { logoB64, period, dateStr }) ?? y;
    } else {
      y = nextY;
    }
  }

  if (selectedSections.includes('savings') && Array.isArray(dashboardData.savingsDist) && dashboardData.savingsDist.length > 0) {
    const nextY = drawDashboardSavings(doc, y, dashboardData.savingsDist);
    if (nextY == null) {
      doc.addPage();
      drawDashboardHeader(doc, { logoB64, period, dateStr });
      y = 66;
      y = drawDashboardSavings(doc, y, dashboardData.savingsDist) ?? y;
    } else {
      y = nextY;
    }
  }

  if (selectedSections.includes('categories') && Array.isArray(dashboardData.categories) && dashboardData.categories.length > 0) {
    if (y + 160 > PH - 62) {
      doc.addPage();
      drawDashboardHeader(doc, { logoB64, period, dateStr });
      y = 66;
    }
    const nextY = drawDashboardCategoriesDark(doc, y, dashboardData.categories);
    if (nextY == null) {
      doc.addPage();
      drawDashboardHeader(doc, { logoB64, period, dateStr });
      y = 66;
      y = drawDashboardCategoriesDark(doc, y, dashboardData.categories) ?? y;
    } else {
      y = nextY;
    }
  }

  if (selectedSections.includes('risk') && Array.isArray(dashboardData.allRiskUsers) && dashboardData.allRiskUsers.length > 0) {
    if (y + 460 > PH - 62) {
      doc.addPage();
      drawDashboardHeader(doc, { logoB64, period, dateStr });
      y = 66;
    }
    const nextY = drawDashboardRisk(doc, y, dashboardData.allRiskUsers, { logoB64, period, dateStr });
    if (nextY == null) {
      doc.addPage();
      drawDashboardHeader(doc, { logoB64, period, dateStr });
      y = 66;
      y = drawDashboardRisk(doc, y, dashboardData.allRiskUsers, { logoB64, period, dateStr }) ?? y;
    } else {
      y = nextY;
    }
  }

  const totalPages = doc.internal.getNumberOfPages();
  const footerPages = Math.max(totalPages, 3);
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawDashboardFooter(doc, page, footerPages, dateStr);
  }

  doc.save(`PESO_AI_Analytics_${now.toISOString().slice(0, 10)}.pdf`);
  return;
  const ctx     = { dateStr, period };

  // PAGE 1: Cover
  drawCoverPage(doc, { dateStr, timeStr, logoB64, period, selected, dashboardData });

  // PAGE 2+: Data
  doc.addPage();
  drawPageHeader(doc, ctx);
  cur.y = PAGE_TOP + 10;

  let sectionNum = 1;

  /* ── KPIs ── */
  if (selected.includes('kpis') && dashboardData.kpis) {
    const k = dashboardData.kpis;
    drawSection(doc, cur, `${sectionNum++}. Key Performance Indicators`, ctx);
    drawTable(doc, cur, [
      { label: 'METRIC',      width: CW * 0.30 },
      { label: 'VALUE',       width: CW * 0.28, align: 'right' },
      { label: 'DESCRIPTION', width: CW * 0.42 },
    ], [
      ['Total Users',   String(k.total_users ?? '0'),  'All registered users in the system'],
      ['Active Users',  `${k.pct_active ?? 0}%`,       'Users active within current period'],
      ['Avg. Income',   fmtPDF(k.avg_income),           'Average income across all users'],
      ['Avg. Expenses', fmtPDF(k.avg_expenses),         'Average total expenses per user'],
      ['Avg. Savings',  fmtPDF(k.avg_savings),          'Average savings (income − expenses)'],
    ], { accentColors: [C.indigo, C.green, C.blue, C.red, C.amber], ctx });
  }

  /* ── Trend ── */
  if (selected.includes('trend') && dashboardData.trend?.length > 0) {
    drawSection(doc, cur, `${sectionNum++}. Financial Trend  (${period})`, ctx);
    const trendRows = dashboardData.trend.map(d => {
      const inc = Number(d.avg_income || 0);
      const sav = Number(d.avg_savings || 0);
      const exp = Number(d.avg_expenses || 0);
      let rate = '-';
      if (inc > 0) rate = ((sav / inc) * 100).toFixed(1) + '%';
      else if (sav !== 0 && exp > 0) rate = 'Deficit';
      return [String(d.label || '-'), fmtPDF(inc), fmtPDF(exp), fmtPDF(sav), rate];
    });
    drawTable(doc, cur, [
      { label: 'PERIOD / LABEL', width: CW * 0.22 },
      { label: 'AVG. INCOME',    width: CW * 0.20, align: 'right' },
      { label: 'AVG. EXPENSES',  width: CW * 0.20, align: 'right' },
      { label: 'AVG. SAVINGS',   width: CW * 0.20, align: 'right' },
      { label: 'SAVINGS RATE',   width: CW * 0.18, align: 'right' },
    ], trendRows, {
      accentColors: dashboardData.trend.map(d => Number(d.avg_savings || 0) >= 0 ? C.green : C.red),
      ctx,
    });
    doc.setFillColor(245, 248, 255);
    doc.roundedRect(ML, cur.y - 8, CW, 20, 3, 3, 'F');
    doc.setDrawColor(...C.indigo);
    doc.setLineWidth(0.5);
    doc.roundedRect(ML, cur.y - 8, CW, 20, 3, 3, 'S');
    doc.setFillColor(...C.indigo);
    doc.rect(ML, cur.y - 8, 4, 20, 'F');
    setFont(doc, 'bold', 7.5, C.indigo);
    doc.text('Formula:', ML + 12, cur.y + 6);
    setFont(doc, 'normal', 7.5, C.textMid);
    doc.text('Savings Rate = (AVG. SAVINGS ÷ AVG. INCOME) × 100   |   Shown as "Deficit" when income = 0 but expenses exist.', ML + 52, cur.y + 6);
    cur.adv(22);
  }

  /* ── Savings Distribution ── */
  if (selected.includes('savings') && dashboardData.savingsDist?.length > 0) {
    const dist  = dashboardData.savingsDist.filter(d => d.value > 0);
    const total = dist.reduce((s, d) => s + d.value, 0);
    drawSection(doc, cur, `${sectionNum++}. Savings Distribution`, ctx);
    const savRows = dist.map(d => {
      const share = total > 0 ? ((d.value / total) * 100).toFixed(1) + '%' : '0%';
      return [d.name, String(d.value), share, saverPill(d.name)];
    });
    savRows.push(['TOTAL', String(total), '100%', '']);
    const savAccents = dist.map(d => ({ 'Negative Saver': C.red, 'Low Saver': C.amber, 'Mid Saver': C.indigo, 'High Saver': C.green })[d.name] || C.teal);
    savAccents.push(C.teal);
    drawTable(doc, cur, [
      { label: 'CLASSIFICATION', width: CW * 0.38 },
      { label: 'USER COUNT',     width: CW * 0.20, align: 'right' },
      { label: 'SHARE (%)',      width: CW * 0.18, align: 'right' },
      { label: 'STATUS',         width: CW * 0.24, align: 'center' },
    ], savRows, { accentColors: savAccents, ctx });
  }

  /* ── Categories ── */
  if (selected.includes('categories') && dashboardData.categories?.length > 0) {
    const top6      = dashboardData.categories.slice(0, 6);
    const top6Total = top6.reduce((s, c) => s + Number(c.total_spent || 0), 0);
    drawSection(doc, cur, `${sectionNum++}. Top Spending Categories`, ctx);
    const catRows = top6.map((c, i) => {
      const share  = top6Total > 0 ? Math.round((Number(c.total_spent) / top6Total) * 100) : 0;
      const status = share >= SPENDING_THRESHOLDS.CRITICAL ? 'Over Limit' : share >= SPENDING_THRESHOLDS.CAUTION ? 'Caution' : 'Normal';
      return [String(i + 1), c.category, fmtPDF(c.total_spent), share + '%', spendPill(status)];
    });
    drawTable(doc, cur, [
      { label: '#',           width: CW * 0.07, align: 'center' },
      { label: 'CATEGORY',    width: CW * 0.30 },
      { label: 'TOTAL SPENT', width: CW * 0.22, align: 'right' },
      { label: 'SHARE (%)',   width: CW * 0.15, align: 'right' },
      { label: 'STATUS',      width: CW * 0.26, align: 'center' },
    ], catRows, {
      accentColors: top6.map(c => { const h = c.color_hex || '#6366F1'; return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }),
      ctx,
    });
  }

  /* ── Risk Users ── */
  if (selected.includes('risk') && dashboardData.allRiskUsers?.length > 0) {
    drawSection(doc, cur, `${sectionNum++}. Risk Users  (by Expense Ratio)`, ctx);
    const highCt = dashboardData.allRiskUsers.filter(u => u.risk_level === 'High').length;
    const medCt  = dashboardData.allRiskUsers.filter(u => u.risk_level === 'Medium').length;
    const lowCt  = dashboardData.allRiskUsers.filter(u => u.risk_level === 'Low').length;
    drawTable(doc, cur, [
      { label: 'RISK LEVEL', width: CW * 0.34, align: 'center' },
      { label: 'USER COUNT', width: CW * 0.33, align: 'center' },
      { label: 'THRESHOLD',  width: CW * 0.33, align: 'center' },
    ], [
      [{ __pill: true, text: 'High Risk',   bgColor: C.redLt,   textColor: C.red   }, String(highCt), `Expense Ratio ≥ ${RISK_THRESHOLDS.HIGH}%`],
      [{ __pill: true, text: 'Medium Risk', bgColor: C.amberLt, textColor: C.amber }, String(medCt),  `Expense Ratio ≥ ${RISK_THRESHOLDS.MEDIUM}%`],
      [{ __pill: true, text: 'Low Risk',    bgColor: C.greenLt, textColor: C.green }, String(lowCt),  `Expense Ratio < ${RISK_THRESHOLDS.MEDIUM}%`],
    ], { accentColors: [C.red, C.amber, C.green], ctx });

    doc.setFillColor(245, 248, 255);
    doc.roundedRect(ML, cur.y - 8, CW, 20, 3, 3, 'F');
    doc.setDrawColor(...C.indigo);
    doc.setLineWidth(0.5);
    doc.roundedRect(ML, cur.y - 8, CW, 20, 3, 3, 'S');
    doc.setFillColor(...C.indigo);
    doc.rect(ML, cur.y - 8, 4, 20, 'F');
    setFont(doc, 'bold', 7.5, C.indigo);
    doc.text('Formula:', ML + 12, cur.y + 6);
    setFont(doc, 'normal', 7.5, C.textMid);
    doc.text("Expense Ratio = (AVG. EXPENSES ÷ AVG. INCOME) × 100   |   Columns below show Income & Expenses so you can verify each user's ratio.", ML + 52, cur.y + 6);
    cur.adv(22);

    const sortOrder = { High: 0, Medium: 1, Low: 2 };
    const sorted = [...dashboardData.allRiskUsers].sort((a, b) => (sortOrder[a.risk_level] ?? 3) - (sortOrder[b.risk_level] ?? 3));
    drawTable(doc, cur, [
      { label: 'FULL NAME',     width: CW * 0.22 },
      { label: 'EMAIL',         width: CW * 0.26 },
      { label: 'AVG. INCOME',   width: CW * 0.13, align: 'right' },
      { label: 'AVG. EXPENSES', width: CW * 0.13, align: 'right' },
      { label: 'EXP. RATIO',    width: CW * 0.10, align: 'right' },
      { label: 'RISK LEVEL',    width: CW * 0.16, align: 'center' },
    ], sorted.map(u => [
      u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || '-',
      u.email || '-',
      fmtPDF(u.total_income),
      fmtPDF(u.total_expenses),
      Number(u.expense_ratio).toFixed(1) + '%',
      riskPill(u.risk_level),
    ]), {
      accentColors: sorted.map(u => ({ High: C.red, Medium: C.amber, Low: C.green })[u.risk_level] || C.teal),
      ctx,
    });
  }

  stampFooters(doc, doc.internal.getNumberOfPages());
  doc.save(`PESO_AI_Analytics_${now.toISOString().slice(0, 10)}.pdf`);
};

/* ═══════════════════════════════════════════════════════════════════════════════
   EXECUTIVE SUMMARY (ONE-PAGE)
═══════════════════════════════════════════════════════════════════════════════ */
export const generateExecutiveSummaryPDF = async (dashboardData, logoSrc) => {
  await loadjsPDF();
  const logoB64 = await getPDFLogoBase64(logoSrc);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const period  = (dashboardData.trendFilter || 'monthly').charAt(0).toUpperCase()
                + (dashboardData.trendFilter || 'monthly').slice(1);

  drawPageHeader(doc, { dateStr, period });

  let y = PAGE_TOP + 12;
  setFont(doc, 'bold', 16, C.textDark);
  doc.text('Executive Summary', ML, y);
  setFont(doc, 'normal', 8.5, C.textMuted);
  doc.text(`Generated ${dateStr} · ${timeStr}`, ML, y + 14);

  // KPI cards
  const k = dashboardData.kpis || {};
  const statY = y + 26;
  const cardW = CW / 3;
  const stats = [
    { label: 'Avg. Income',   value: fmtPDF(k.avg_income),   color: C.green },
    { label: 'Avg. Expenses', value: fmtPDF(k.avg_expenses), color: C.red   },
    { label: 'Avg. Savings',  value: fmtPDF(k.avg_savings),  color: C.indigo },
  ];
  stats.forEach((s, i) => {
    const cx = ML + i * cardW;
    doc.setFillColor(...C.offWhite);
    doc.roundedRect(cx + 2, statY, cardW - 4, 42, 6, 6, 'F');
    doc.setFillColor(...s.color);
    doc.rect(cx + 2, statY, 4, 42, 'F');
    setFont(doc, 'bold', 14, s.color);
    doc.text(String(s.value), cx + cardW / 2 + 2, statY + 24, { align: 'center' });
    setFont(doc, 'normal', 7.5, C.textMuted);
    doc.text(s.label.toUpperCase(), cx + cardW / 2 + 2, statY + 35, { align: 'center' });
  });

  const cur = makeCur(statY + 56);
  const ctx = { dateStr, period };

  // Income & Savings Snapshot
  drawSection(doc, cur, 'Income & Savings Snapshot', ctx);
  const avgIncome = Number(k.avg_income || 0);
  const avgSavings = Number(k.avg_savings || 0);
  const avgExpenses = Number(k.avg_expenses || 0);
  const savingsRate = avgIncome > 0 ? ((avgSavings / avgIncome) * 100).toFixed(1) + '%' : 'N/A';
  const expenseRatio = avgIncome > 0 ? ((avgExpenses / avgIncome) * 100).toFixed(1) + '%' : 'N/A';
  drawTable(doc, cur, [
    { label: 'METRIC', width: CW * 0.40 },
    { label: 'VALUE',  width: CW * 0.60, align: 'right' },
  ], [
    ['Average Income',  fmtPDF(k.avg_income)],
    ['Average Expenses',fmtPDF(k.avg_expenses)],
    ['Average Savings', fmtPDF(k.avg_savings)],
    ['Savings Rate',    savingsRate],
    ['Expense Ratio',   expenseRatio],
  ], { ctx });

  // Income vs Expenses (last 3)
  const trend = Array.isArray(dashboardData.trend) ? dashboardData.trend : [];
  const tail3 = trend.slice(-3);
  if (tail3.length > 0) {
    drawSection(doc, cur, 'Income vs Expenses (Last 3)', ctx);
    drawTable(doc, cur, [
      { label: 'PERIOD',        width: CW * 0.34 },
      { label: 'AVG. INCOME',   width: CW * 0.33, align: 'right' },
      { label: 'AVG. EXPENSES', width: CW * 0.33, align: 'right' },
    ], tail3.map(d => [String(d.label || '-'), fmtPDF(d.avg_income), fmtPDF(d.avg_expenses)]), { ctx });
  }

  // User Growth
  const usersFromTrend = trend
    .map(d => Number(d.user_count ?? d.total_users ?? d.users))
    .filter(v => Number.isFinite(v));
  const lastTrendUsers = usersFromTrend.length > 0 ? usersFromTrend[usersFromTrend.length - 1] : 0;
  const currentUsers = Number.isFinite(Number(k.total_users)) ? Number(k.total_users) : (lastTrendUsers || 0);
  const prevUsersRaw = Number(k.prev_total_users ?? k.total_users_prev ?? k.total_users_previous ?? NaN);
  const prevUsers = Number.isFinite(prevUsersRaw) ? prevUsersRaw : (usersFromTrend[0] || NaN);
  const growthPct = prevUsers && Number.isFinite(prevUsers) && prevUsers > 0
    ? (((currentUsers - prevUsers) / prevUsers) * 100).toFixed(1) + '%'
    : 'N/A';
  drawSection(doc, cur, 'User Growth', ctx);
  drawTable(doc, cur, [
    { label: 'METRIC', width: CW * 0.40 },
    { label: 'VALUE',  width: CW * 0.60, align: 'right' },
  ], [
    ['Total Users', String(currentUsers || 0)],
    ['Active Users %', `${k.pct_active ?? 0}%`],
    ['Growth Rate', growthPct],
  ], { ctx });

  // Top Spending Categories (Top 3)
  const cats = Array.isArray(dashboardData.categories) ? dashboardData.categories : [];
  if (cats.length > 0) {
    const top3 = cats.slice(0, 3);
    const total = top3.reduce((s, c) => s + Number(c.total_spent || 0), 0);
    drawSection(doc, cur, 'Top Spending Categories (Top 3)', ctx);
    drawTable(doc, cur, [
      { label: 'CATEGORY', width: CW * 0.50 },
      { label: 'TOTAL',    width: CW * 0.30, align: 'right' },
      { label: 'SHARE',    width: CW * 0.20, align: 'right' },
    ], top3.map(c => {
      const share = total > 0 ? Math.round((Number(c.total_spent || 0) / total) * 100) + '%' : '0%';
      return [String(c.category || '-'), fmtPDF(c.total_spent), share];
    }), { ctx });
  }

  // Risk Overview
  const risks = Array.isArray(dashboardData.allRiskUsers) ? dashboardData.allRiskUsers : [];
  if (risks.length > 0) {
    const highCt = risks.filter(u => u.risk_level === 'High').length;
    const medCt  = risks.filter(u => u.risk_level === 'Medium').length;
    const lowCt  = risks.filter(u => u.risk_level === 'Low').length;
    drawSection(doc, cur, 'Risk Overview', ctx);
    drawTable(doc, cur, [
      { label: 'LEVEL', width: CW * 0.50 },
      { label: 'USERS', width: CW * 0.50, align: 'right' },
    ], [
      ['High Risk', String(highCt)],
      ['Medium Risk', String(medCt)],
      ['Low Risk', String(lowCt)],
    ], { ctx });
  }

  stampFooters(doc, doc.internal.getNumberOfPages());
  doc.save(`PESO_AI_Executive_Summary_${now.toISOString().slice(0, 10)}.pdf`);
};
/* ══════════════════════════════════════════════════════════════
   SHARED PDF UTILITIES — used by auditPDF.js, usersPDF.js, etc.
══════════════════════════════════════════════════════════════ */

// Aliases para sa auditPDF / usersPDF compatibility
export const CW_PDF = CW;

export const getLogoBase64 = getPDFLogoBase64;

export { loadjsPDF };
export { fitPDFText };

// PT — shared colour tokens (mirrors C but named PT for other PDFs)
export const PT = {
  navy:      C.navy,
  navyDark:  C.navyDark,
  teal:      C.teal,
  blue:      C.blue,
  white:     C.white,
  offWhite:  C.offWhite,
  bgStripe:  C.stripe,
  lineGray:  C.line,
  textDark:  C.textDark,
  textMid:   C.textMid,
  textMuted: C.textMuted,
  green:     C.green,
  greenLt:   C.greenLt,
  red:       C.red,
  redLt:     C.redLt,
  amber:     C.amber,
  amberLt:   C.amberLt,
  indigo:    C.indigo,
  indigoLt:  C.indigoLt,
};

// ptx — font shorthand used by auditPDF / usersPDF
export const ptx = (doc, style, size, color) => {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};

// palpha — fill with opacity helper
export const palpha = (doc, color, opacity = 1) => {
  doc.setFillColor(...color);
  doc.setGState && doc.setGState(new doc.GState({ opacity }));
};

// pguard — page guard for auditPDF / usersPDF
export const pguard = (doc, cur, need = 30) => {
  if (cur.y + need > PH - 36) {
    doc.addPage();
    cur.y = 42 + 6;
    return true;
  }
  return false;
};

// drawPDFHeader — cover/header for auditPDF / usersPDF
export const drawPDFHeader = (doc, { title, subtitle, dateStr, timeStr, logoB64 }) => {
  doc.setFillColor(...C.navyDark);
  doc.rect(0, 0, PW, 72, 'F');
  doc.setFillColor(...C.teal);
  doc.rect(0, 70, PW, 3, 'F');
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, 6, 72, 'F');

  if (logoB64) {
    try { doc.addImage(logoB64, 'PNG', ML + 8, 12, 40, 40); } catch (_) {}
  }
  const tx = ML + (logoB64 ? 58 : 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('PESO AI  ·  ' + title, tx, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 180, 230);
  doc.text(subtitle, tx, 48);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 140, 200);
  doc.text(`Generated: ${dateStr}  ·  ${timeStr}`, tx, 62);

  return 84; // returns starting y for content
};

// stampPDFFooters — footer for auditPDF / usersPDF
export const stampPDFFooters = (doc, reportName, totalPages) => {
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFillColor(...C.navyDark);
    doc.rect(0, PH - 28, PW, 28, 'F');
    doc.setFillColor(...C.teal);
    doc.rect(0, PH - 28, PW, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 185, 230);
    doc.text(`PESO AI  ·  ${reportName}  ·  Confidential`, ML, PH - 10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 210, 255);
    doc.text(`Page ${pg} of ${totalPages}`, PW - MR, PH - 10, { align: 'right' });
  }
};

// drawPDFStatCards — stat summary row
export const drawPDFStatCards = (doc, cur, stats) => {
  const cardW = CW / stats.length;
  stats.forEach((s, i) => {
    const cx = ML + i * cardW;
    doc.setFillColor(...C.offWhite);
    doc.roundedRect(cx + 2, cur.y, cardW - 4, 38, 6, 6, 'F');
    doc.setFillColor(...s.color);
    doc.rect(cx + 2, cur.y, 4, 38, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...s.color);
    doc.text(String(s.value), cx + cardW / 2 + 2, cur.y + 22, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text(s.label.toUpperCase(), cx + cardW / 2 + 2, cur.y + 33, { align: 'center' });
  });
  cur.adv(48);
};

// drawPDFSectionBar — dark section divider
export const drawPDFSectionBar = (doc, cur, text) => {
  doc.setFillColor(...C.navy);
  doc.rect(ML, cur.y, CW, 26, 'F');
  doc.setFillColor(...C.teal);
  doc.rect(ML, cur.y, 5, 26, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.white);
  doc.text(text.toUpperCase(), ML + 14, cur.y + 17);
  cur.adv(32);
};

// drawPDFTableHeader — table column headers
export const drawPDFTableHeader = (doc, cur, cols) => {
  doc.setFillColor(...C.navyDark);
  doc.rect(ML, cur.y, CW, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.white);
  cols.forEach(col => {
    doc.text(col.label, col.x + 5, cur.y + 15);
  });
  cur.adv(22);
};



