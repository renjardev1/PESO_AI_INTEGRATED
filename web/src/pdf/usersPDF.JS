import {
  loadjsPDF, getLogoBase64,
  PT, ML,
  fitPDFText,
} from './pdfHelpers';

export const generateUsersPDF = async (users, filters, logoSrc) => {
  await loadjsPDF();
  const logoB64 = await getLogoBase64(logoSrc);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginRight = 34;
  const topMargin = 26;
  const bottomMargin = 24;
  const contentWidth = pageWidth - ML - marginRight;
  const contentBottom = pageHeight - bottomMargin;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const active = users.filter((u) => u.onboarding_completed === true).length;
  const inactive = users.filter((u) => u.onboarding_completed !== true).length;
  const actRate = users.length ? Math.round((active / users.length) * 100) : 0;
  const filterLine = [
    filters.search && `Search: "${filters.search}"`,
    filters.status && filters.status !== 'All' && `Status: ${filters.status}`,
  ].filter(Boolean).join('  ·  ') || 'All users';

  const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
  const fmtDate = (d) => (!d
    ? '—'
    : new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }));

  const cols = (() => {
    const defs = [
      { label: '#', w: 26, align: 'center' },
      { label: 'User ID', w: 152 },
      { label: 'Full Name', w: 125 },
      { label: 'Email', w: 180 },
      { label: 'Location', w: 160 },
      { label: 'Joined', w: 82, align: 'center' },
      { label: 'Last Active', w: 86, align: 'center' },
      { label: 'Status', w: 73, align: 'center' },
    ];

    let x = ML;
    return defs.map((col) => {
      const out = { ...col, x };
      x += col.w;
      return out;
    });
  })();

  const tableWidth = cols.reduce((sum, col) => sum + col.w, 0);
  const tableX = ML + Math.max(0, (contentWidth - tableWidth) / 2);
  cols.forEach((col) => {
    col.x = tableX + (col.x - ML);
  });

  let y = topMargin;

  const setFont = (style, size, color) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const drawFooter = () => {
    doc.setFillColor(...PT.navyDark);
    doc.rect(0, pageHeight - 22, pageWidth, 22, 'F');
    doc.setFillColor(...PT.teal);
    doc.rect(0, pageHeight - 22, pageWidth, 2, 'F');
    setFont('normal', 7, [145, 185, 230]);
    doc.text('PESO AI  ·  User Management Report  ·  Confidential', ML, pageHeight - 8);
    setFont('bold', 7, [190, 215, 255]);
    doc.text(`Generated ${dateStr}  ·  ${timeStr}`, pageWidth - marginRight, pageHeight - 8, { align: 'right' });
  };

  const drawHeader = () => {
    const headerH = 92;
    doc.setFillColor(...PT.navyDark);
    doc.roundedRect(ML, y, contentWidth, headerH, 14, 14, 'F');
    doc.setFillColor(...PT.teal);
    doc.roundedRect(ML, y + headerH - 4, contentWidth, 4, 4, 4, 'F');

    if (logoB64) {
      try {
        doc.addImage(logoB64, 'PNG', ML + 18, y + 17, 42, 42);
      } catch {}
    }

    const textX = ML + 76;
    setFont('bold', 21, PT.white);
    doc.text('PESO AI  ·  User Access Control Report', textX, y + 34);
    setFont('normal', 10, [160, 195, 240]);
    doc.text(`${users.length} users  ·  ${filterLine}`, textX, y + 56);
    setFont('normal', 9, [115, 160, 220]);
    doc.text(`Generated ${dateStr}  ·  ${timeStr}`, textX, y + 76);

    const metaW = 180;
    const metaX = ML + contentWidth - metaW - 18;
    doc.setFillColor(22, 36, 74);
    doc.roundedRect(metaX, y + 16, metaW, 52, 10, 10, 'F');
    setFont('bold', 8, [140, 190, 235]);
    doc.text('REPORT SNAPSHOT', metaX + 14, y + 31);
    setFont('normal', 8.5, PT.white);
    doc.text(`Active Users: ${active}`, metaX + 14, y + 47);
    doc.text(`Inactive Users: ${inactive}`, metaX + 14, y + 61);

    y += headerH + 16;
  };

  const drawStatCards = () => {
    const cards = [
      { label: 'Total Users', value: users.length, color: PT.blue },
      { label: 'Active', value: active, color: PT.green },
      { label: 'Inactive', value: inactive, color: PT.red },
      { label: 'Active Rate', value: `${actRate}%`, color: PT.teal },
    ];
    const gap = 12;
    const cardW = (contentWidth - gap * (cards.length - 1)) / cards.length;
    const cardH = 52;

    cards.forEach((card, index) => {
      const x = ML + index * (cardW + gap);
      doc.setFillColor(...PT.offWhite);
      doc.roundedRect(x, y, cardW, cardH, 10, 10, 'F');
      doc.setFillColor(...card.color);
      doc.roundedRect(x, y, 5, cardH, 10, 10, 'F');
      setFont('bold', 18, card.color);
      doc.text(String(card.value), x + cardW / 2, y + 26, { align: 'center' });
      setFont('normal', 8, PT.textMuted);
      doc.text(card.label.toUpperCase(), x + cardW / 2, y + 41, { align: 'center' });
    });

    y += cardH + 14;
  };

  const drawDistributionBar = () => {
    if (!users.length) return;

    setFont('bold', 8, PT.textMid);
    doc.text('ACCOUNT STATUS DISTRIBUTION', ML, y);
    const barY = y + 8;
    const barH = 14;
    const activeW = (active / users.length) * contentWidth;

    doc.setFillColor(...PT.lineGray);
    doc.roundedRect(ML, barY, contentWidth, barH, 7, 7, 'F');
    doc.setFillColor(...PT.green);
    doc.roundedRect(ML, barY, activeW, barH, 7, 7, 'F');
    doc.setFillColor(...PT.red);
    doc.roundedRect(ML + activeW, barY, contentWidth - activeW, barH, 7, 7, 'F');

    setFont('bold', 7.5, PT.white);
    if (activeW > 70) doc.text(`${active} Active`, ML + activeW / 2, barY + 10, { align: 'center' });
    if (contentWidth - activeW > 80) {
      doc.text(`${inactive} Inactive`, ML + activeW + (contentWidth - activeW) / 2, barY + 10, { align: 'center' });
    }

    y = barY + barH + 20;
  };

  const drawSectionLabel = () => {
    doc.setFillColor(...PT.navy);
    doc.roundedRect(tableX, y, tableWidth, 28, 8, 8, 'F');
    doc.setFillColor(...PT.teal);
    doc.roundedRect(tableX, y, 6, 28, 8, 8, 'F');
    setFont('bold', 10, PT.white);
    doc.text(`USER RECORDS — ${users.length} USERS`, tableX + 16, y + 18);
    y += 36;
  };

  const drawTableHeader = () => {
    doc.setFillColor(...PT.navyDark);
    doc.roundedRect(tableX, y, tableWidth, 24, 0, 0, 'F');
    setFont('bold', 8.5, PT.white);
    cols.forEach((col) => {
      if (col.align === 'center') {
        doc.text(col.label, col.x + col.w / 2, y + 15, { align: 'center' });
      } else {
        doc.text(col.label, col.x + 7, y + 15);
      }
    });
    y += 24;
  };

  const ensureRowSpace = (needed = 24) => {
    if (y + needed > contentBottom - 16) {
      drawFooter();
      doc.addPage();
      y = topMargin;
      drawHeader();
      drawSectionLabel();
      drawTableHeader();
    }
  };

  drawHeader();
  drawStatCards();
  drawDistributionBar();
  drawSectionLabel();
  drawTableHeader();

  users.forEach((user, index) => {
    const rowH = 28;
    ensureRowSpace(rowH);

    const rowFill = index % 2 === 0 ? PT.white : PT.offWhite;
    const isActive = user.onboarding_completed === true;

    doc.setFillColor(...rowFill);
    doc.rect(tableX, y, tableWidth, rowH, 'F');
    doc.setFillColor(...(isActive ? PT.green : PT.red));
    doc.rect(tableX, y, 3, rowH, 'F');

    doc.setDrawColor(...PT.lineGray);
    doc.setLineWidth(0.35);
    doc.line(tableX, y + rowH, tableX + tableWidth, y + rowH);

    const row = [
      String(index + 1),
      String(user.id || user.user_id || '—').toUpperCase(),
      fullName(user),
      String(user.email || '—'),
      String(user.location || '—'),
      fmtDate(user.created_at),
      fmtDate(user.last_active_at),
      isActive ? 'ACTIVE' : 'INACTIVE',
    ];

    cols.forEach((col, colIndex) => {
      const value = row[colIndex];

      if (col.label === 'Status') {
        const pillW = 58;
        const pillH = 14;
        const pillX = col.x + (col.w - pillW) / 2;
        const pillY = y + (rowH - pillH) / 2;
        doc.setFillColor(...(isActive ? PT.greenLt : PT.redLt));
        doc.roundedRect(pillX, pillY, pillW, pillH, 4, 4, 'F');
        setFont('bold', 7.5, isActive ? PT.green : PT.red);
        doc.text(isActive ? 'ACTIVE' : 'INACTIVE', pillX + pillW / 2, pillY + 10, { align: 'center' });
        return;
      }

      const color = colIndex === 2 ? PT.textDark : colIndex >= 5 ? PT.textMid : PT.textMuted;
      const style = colIndex === 2 || colIndex === 1 ? 'bold' : 'normal';
      const size = colIndex === 1 ? 7.4 : 8.3;
      setFont(style, size, color);

      if (col.align === 'center') {
        doc.text(fitPDFText(doc, value, col.w - 12), col.x + col.w / 2, y + 18, { align: 'center' });
      } else {
        doc.text(fitPDFText(doc, value, col.w - 12), col.x + 7, y + 18);
      }
    });

    y += rowH;
  });

  drawFooter();
  doc.save(`PESO_AI_Users_${now.toISOString().slice(0, 10)}.pdf`);
};
