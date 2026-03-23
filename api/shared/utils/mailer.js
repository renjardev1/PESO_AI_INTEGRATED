import nodemailer from 'nodemailer';

// nodemailer v8 — createTransport API is unchanged, safe to upgrade
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,   // set in .env as GMAIL_PASS
  },
});

export const sendPasswordResetOtp = async (toEmail, firstName, otp) => {
  const appName = process.env.APP_NAME || 'PESO AI';
  await transporter.sendMail({
    from:    `"${appName}" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: `${appName} — Password Reset Code`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:12px;">
        <h2 style="color:#2196F3;margin-bottom:4px;">${appName}</h2>
        <h3 style="margin-top:0;">Password Reset</h3>
        <p>Hi ${firstName},</p>
        <p>You requested a password reset. Use the code below — it expires in <strong>15 minutes</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#2196F3;">${otp}</span>
        </div>
        <p style="color:#888;font-size:12px;">If you did not request this, ignore this email. Your password will not change.</p>
      </div>
    `,
  });
};
