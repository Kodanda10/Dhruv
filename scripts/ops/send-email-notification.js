#!/usr/bin/env node

/**
 * Email Notification Helper
 * Sends email notifications via SMTP (Gmail, SendGrid, etc.)
 */

const nodemailer = require('nodemailer');

// Check if nodemailer is available, if not, provide fallback
let transporter = null;

try {
  // Try to create transporter (will fail if credentials not set)
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || process.env.GMAIL_USER,
      pass: process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD,
    },
  });
} catch (error) {
  console.warn('Email transporter not configured:', error.message);
}

async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    console.warn('⚠️  Email not configured. Set EMAIL_USER and EMAIL_PASSWORD env vars.');
    console.log('Would send email to:', to);
    console.log('Subject:', subject);
    console.log('Body:', text);
    return { success: false, reason: 'not_configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER || process.env.GMAIL_USER,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    });

    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function sendPipelineStatusEmail(stats) {
  const { raw, parsed, review } = stats;
  
  const subject = `📊 Pipeline Status Report - ${new Date().toLocaleDateString()}`;
  
  const text = `
Pipeline Status Report
======================

Raw Tweets:
  • Total: ${raw.total || 0}
  • Pending: ${raw.pending || 0}
  • Parsed: ${raw.parsed || 0}
  • Failed: ${raw.failed || 0}

Parsed Events:
  • Total: ${parsed.total || 0}

Review Status:
  • Needs Review: ${review.needs_review || 0}
  • Approved: ${review.approved || 0}
  • Rejected: ${review.rejected || 0}

Generated: ${new Date().toISOString()}
  `;

  const html = `
    <h2>Pipeline Status Report</h2>
    <h3>Raw Tweets</h3>
    <ul>
      <li>Total: <strong>${raw.total || 0}</strong></li>
      <li>Pending: <strong>${raw.pending || 0}</strong></li>
      <li>Parsed: <strong>${raw.parsed || 0}</strong></li>
      <li>Failed: <strong>${raw.failed || 0}</strong></li>
    </ul>
    <h3>Parsed Events</h3>
    <p>Total: <strong>${parsed.total || 0}</strong></p>
    <h3>Review Status</h3>
    <ul>
      <li>Needs Review: <strong>${review.needs_review || 0}</strong></li>
      <li>Approved: <strong>${review.approved || 0}</strong></li>
      <li>Rejected: <strong>${review.rejected || 0}</strong></li>
    </ul>
    <p><small>Generated: ${new Date().toISOString()}</small></p>
  `;

  return sendEmail({
    to: process.env.NOTIFICATION_EMAIL || '9685528000as@gmail.com',
    subject,
    text,
    html,
  });
}

module.exports = {
  sendEmail,
  sendPipelineStatusEmail,
};


