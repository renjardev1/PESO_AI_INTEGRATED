import pool from '../../config/db.js';

import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';

const exportTransactionsPDF = async (req, res) => {
    const { userId } = req.params;
    const { period = '30d', startDate, endDate } = req.query;

    let dateFilter;
    const params = [userId];

    switch (period) {
        case '7d':
            dateFilter = `transaction_date >= CURRENT_DATE - INTERVAL '7 days'`;
            break;
        case '30d':
            dateFilter = `transaction_date >= CURRENT_DATE - INTERVAL '30 days'`;
            break;
        case '60d':
            dateFilter = `transaction_date >= CURRENT_DATE - INTERVAL '60 days'`;
            break;
        case 'custom':
            if (!startDate || !endDate) {
                return res.status(400).json({ success: false, message: 'startDate and endDate required for custom period.' });
            }
            dateFilter = `transaction_date BETWEEN $2 AND $3`;
            params.push(startDate, endDate);
            break;
        default:
            return res.status(400).json({ success: false, message: 'Invalid period.' });
    }

    try {
        const [profileResult, txResult] = await Promise.all([
            pool.query(
                `SELECT u.first_name, u.last_name, u.email,
                        p.monthly_expenses, p.monthly_income
                 FROM users u
                 LEFT JOIN user_profiles p ON u.id = p.user_id
                 WHERE u.id = $1`,
                [userId]
            ),
            pool.query(
                `SELECT id, amount, category, description,
                        transaction_type, transaction_date
                 FROM transactions
                 WHERE user_id = $1 AND ${dateFilter}
                 ORDER BY transaction_date DESC`,
                params
            )
        ]);

        const profile = profileResult.rows[0];
        const txs     = txResult.rows;

        if (!profile) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Subtitle
        const periodLabel = period === 'custom'
        ? `${startDate} to ${endDate}`
        : period === '7d' ? 'Last 7 Days'
        : period === '30d' ? 'Last 30 Days'
        : 'Last 60 Days';

        // ── Build PDF in memory ───────────────────────────────────────────
        const chunks = [];
        const doc    = new PDFDocument({ margin: 40, size: 'A4' });
        doc.on('data', chunk => chunks.push(chunk));

        await new Promise((resolve) => {
            doc.on('end', resolve);

            const fmt = (n) => {
                const num = parseFloat(n);
                const parts = Math.abs(num).toFixed(2).split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                return parts.join('.');
            };
            const pageW = 595 - 80; // A4 width minus margins

            // ── HEADER ────────────────────────────────────────────────────────────
            doc.rect(0, 0, 595, 110).fill('#2196F3');

            doc.fillColor('#FFFFFF')
            .fontSize(20).font('Helvetica-Bold')
            .text('PESO AI — Transaction Report', 40, 24, { width: pageW });

            doc.fontSize(10).font('Helvetica')
            .text(`Period: ${periodLabel}`, 40, 52)
            .text(`Generated: ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}  |  ${txs.length} transaction${txs.length !== 1 ? 's' : ''}`, 40, 67)
            .text(`Account: ${profile.first_name} ${profile.last_name}   |   Email: ${profile.email}`, 40, 82);

            doc.moveDown(4);

            // ── SUMMARY CARD ──────────────────────────────────────────────────────
            const cardTop = 125;
            doc.roundedRect(40, cardTop, pageW, 90, 8).fillAndStroke('#F8F9FA', '#E0E0E0');

            doc.fillColor('#1A1A1A').fontSize(12).font('Helvetica-Bold')
            .text('Summary', 56, cardTop + 12);

            doc.moveTo(56, cardTop + 28).lineTo(40 + pageW - 16, cardTop + 28).stroke('#E0E0E0');

            const budget   = parseFloat(profile.monthly_income || 0);
            const expenses = txs.filter(t => t.transaction_type === 'expense')
                                .reduce((s, t) => s + parseFloat(t.amount), 0);
            const remaining = budget - expenses;

            const col1 = 56, col2 = 220, col3 = 380;
            const rowY  = cardTop + 38;

            // Budget
            doc.fillColor('#757575').fontSize(9).font('Helvetica')
            .text('Budget', col1, rowY);
            doc.fillColor('#4CAF50').fontSize(13).font('Helvetica-Bold')
            .text(`+ PHP ${fmt(budget)}`, col1, rowY + 13);

            // Total Expenses
            doc.fillColor('#757575').fontSize(9).font('Helvetica')
            .text('Total Expenses', col2, rowY);
            doc.fillColor('#F44336').fontSize(13).font('Helvetica-Bold')
            .text(`- PHP ${fmt(expenses)}`, col2, rowY + 13);

            // Remaining
            doc.fillColor('#757575').fontSize(9).font('Helvetica')
            .text('Remaining', col3, rowY);
            doc.fillColor(remaining >= 0 ? '#2196F3' : '#F44336').fontSize(13).font('Helvetica-Bold')
            .text(`PHP ${fmt(remaining)}`, col3, rowY + 13);

            doc.moveDown(1);

            // ── CATEGORY BREAKDOWN ────────────────────────────────────────────────
            const catColors = [
                '#2196F3', '#4CAF50', '#F44336', '#FF9800',
                '#9C27B0', '#00BCD4', '#795548', '#607D8B'
            ];

            const catMap = {};
            txs.filter(t => t.transaction_type === 'expense').forEach(t => {
                if (!catMap[t.category]) catMap[t.category] = 0;
                catMap[t.category] += parseFloat(t.amount);
            });
            const breakdown = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

            const breakdownTop = cardTop + 105;
            doc.roundedRect(40, breakdownTop, pageW, 28 + breakdown.length * 20, 8)
            .fillAndStroke('#F8F9FA', '#E0E0E0');

            doc.fillColor('#1A1A1A').fontSize(12).font('Helvetica-Bold')
            .text('Category Breakdown', 56, breakdownTop + 10);

            doc.moveTo(56, breakdownTop + 26).lineTo(40 + pageW - 16, breakdownTop + 26).stroke('#E0E0E0');

            breakdown.forEach(([cat, total], i) => {
                const y = breakdownTop + 34 + i * 20;
                const color = catColors[i % catColors.length];

                // Color dot
                doc.circle(62, y + 5, 4).fill(color);

                doc.fillColor(color).fontSize(10).font('Helvetica-Bold')
                .text(cat.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        72, y, { continued: true, width: 280 });

                doc.fillColor('#1A1A1A').font('Helvetica')
                .text(`PHP ${fmt(total)}`, { align: 'right', width: pageW - 48 });
            });

            // ── TRANSACTIONS TABLE ────────────────────────────────────────────────
            const tableTop = breakdownTop + 38 + breakdown.length * 20 + 16;

            doc.roundedRect(40, tableTop, pageW, 24, 4).fill('#2196F3');
            doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');

            const c = { date: 48, type: 130, cat: 195, desc: 300, amount: 460 };
            doc.text('Date',        c.date,   tableTop + 7, { width: 80 });
            doc.text('Type',        c.type,   tableTop + 7, { width: 60 });
            doc.text('Category',    c.cat,    tableTop + 7, { width: 100 });
            doc.text('Description', c.desc,   tableTop + 7, { width: 155 });
            doc.text('Amount (₱)',  c.amount, tableTop + 7, { width: 80, align: 'right' });

            let rowTop = tableTop + 26;
            txs.forEach((tx, i) => {
                if (rowTop > 760) {
                    doc.addPage();
                    rowTop = 40;
                }

                const bg = i % 2 === 0 ? '#FFFFFF' : '#F5F8FF';
                doc.rect(40, rowTop, pageW, 18).fill(bg);

                const dateStr = tx.transaction_date
                    ? new Date(tx.transaction_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })
                    : '—';

                const isExpense = tx.transaction_type === 'expense';
                const catIdx    = breakdown.findIndex(([cat]) => cat === tx.category);
                const catColor  = catIdx >= 0 ? catColors[catIdx % catColors.length] : '#607D8B';

                doc.fillColor('#1A1A1A').fontSize(8).font('Helvetica')
                .text(dateStr,              c.date,   rowTop + 4, { width: 80 })
                .text(tx.transaction_type.charAt(0).toUpperCase() + tx.transaction_type.slice(1),
                        c.type,   rowTop + 4, { width: 60 });

                doc.fillColor(catColor).font('Helvetica-Bold')
                .text(tx.category.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        c.cat, rowTop + 4, { width: 100 });

                doc.fillColor('#1A1A1A').font('Helvetica')
                .text(tx.description || '—', c.desc, rowTop + 4, { width: 155 });

                doc.fillColor(isExpense ? '#F44336' : '#4CAF50').font('Helvetica-Bold')
                .text(`PHP ${fmt(tx.amount)}`, c.amount, rowTop + 4, { width: 80, align: 'right' });

                rowTop += 18;
            });

            // ── FOOTER ────────────────────────────────────────────────────────────
            rowTop += 16;
            doc.moveTo(40, rowTop).lineTo(40 + pageW, rowTop).stroke('#E0E0E0');
            doc.fillColor('#9E9E9E').fontSize(8).font('Helvetica')
            .text('PESO AI  |  Confidential', 40, rowTop + 8, { align: 'center', width: pageW });

            doc.end();
        });

        const pdfBuffer = Buffer.concat(chunks);

        // ── Email via Gmail SMTP ──────────────────────────────────────────
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const filename = `peso_ai_report_${period}_${Date.now()}.pdf`;

        await transporter.sendMail({
            from:    `"PESO AI" <${process.env.GMAIL_USER}>`,
            to:      profile.email,
            subject: `PESO AI — Transaction Report (${periodLabel})`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:12px;">
                    <h2 style="color:#2196F3;margin-bottom:4px;">PESO AI</h2>
                    <h3 style="margin-top:0;">Transaction Report</h3>
                    <p>Hi ${profile.first_name},</p>
                    <p>Your transaction report for <strong>${periodLabel}</strong> is attached.</p>
                    <p style="color:#888;font-size:12px;">This report is password-protected. Your password is your registered email address.</p>
                </div>
            `,
            attachments: [{
                filename,
                content:     pdfBuffer,
                contentType: 'application/pdf',
            }]
        });

        return res.json({ success: true, message: `Report sent to ${profile.email}` });

    } catch (err) {
        console.error('[Export] exportTransactionsPDF:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate and send report.' });
    }
};

export { exportTransactionsPDF };
