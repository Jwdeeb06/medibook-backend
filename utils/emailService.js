const nodemailer = require('nodemailer');

// Create transporter from env config
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Base email template wrapper
const baseTemplate = (content, clinicName = 'MediBook Medical Center', clinicEmail = '') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f5f0e8; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #AB1509, #7a0e06); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: #fff7d3; margin: 0; font-size: 24px; }
    .header p { color: rgba(255,247,211,0.8); margin: 8px 0 0; font-size: 14px; }
    .body { background: white; padding: 32px; border-radius: 0 0 12px 12px; }
    .detail-box { background: #f9f6f0; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #AB1509; }
    .detail-row { display: flex; margin-bottom: 10px; }
    .detail-label { color: #6b5a58; font-size: 13px; font-weight: 600; width: 130px; flex-shrink: 0; }
    .detail-value { color: #2a1a18; font-size: 13px; }
    .btn { display: inline-block; background: #AB1509; color: #fff7d3; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-confirmed { background: #d1fae5; color: #065f46; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
    .badge-completed { background: #e0e7ff; color: #3730a3; }
    .note-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .warning-box { background: #fff7d3; border: 1px solid #f5ecc0; border-radius: 8px; padding: 16px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>⚕ ${clinicName}</h1>
      <p>Your health, our priority</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${clinicName}</p>
      ${clinicEmail ? `<p>Questions? Email us at <a href="mailto:${clinicEmail}">${clinicEmail}</a></p>` : ''}
      <p style="color: #d1d5db; font-size: 11px;">This is an automated message, please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
`;

// ============================================================
// SEND EMAIL — main function
// ============================================================
const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`📧 Email skipped (no SMTP config): ${subject} → ${to}`);
    return;
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'MediBook'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent: ${subject} → ${to}`);
  } catch (error) {
    console.error(`❌ Email failed: ${subject} → ${to}:`, error.message);
    // Don't throw — email failure shouldn't break the booking
  }
};

// ============================================================
// EMAIL TEMPLATES
// ============================================================

// 1. Booking created — to patient
exports.sendBookingCreated = async ({ to, patientName, serviceName, doctorName, bookingDate, startTime, price, bookingId, clinicName, clinicEmail }) => {
  const html = baseTemplate(`
    <h2 style="color: #2a1a18; margin-top: 0;">Booking Received! 📅</h2>
    <p>Hi <strong>${patientName}</strong>, your appointment request has been received. We'll confirm it shortly.</p>

    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Booking #</span><span class="detail-value">#${bookingId}</span></div>
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${serviceName}</span></div>
      <div class="detail-row"><span class="detail-label">Doctor</span><span class="detail-value">${doctorName || 'To be assigned'}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${new Date(bookingDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${startTime?.slice(0,5)}</span></div>
      <div class="detail-row"><span class="detail-label">Fee</span><span class="detail-value" style="color: #AB1509; font-weight: 700;">$${price}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-pending">Pending</span></span></div>
    </div>

    <p style="color: #6b5a58; font-size: 14px;">You'll receive another email once your appointment is confirmed.</p>
  `, clinicName, clinicEmail);

  await sendEmail({ to, subject: `Booking Received — ${serviceName} on ${bookingDate}`, html });
};

// 2. Booking confirmed — to patient
exports.sendBookingConfirmed = async ({ to, patientName, serviceName, doctorName, bookingDate, startTime, endTime, bookingId, clinicName, clinicEmail, clinicAddress }) => {
  const html = baseTemplate(`
    <h2 style="color: #059669; margin-top: 0;">Appointment Confirmed ✅</h2>
    <p>Hi <strong>${patientName}</strong>, your appointment has been confirmed!</p>

    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Booking #</span><span class="detail-value">#${bookingId}</span></div>
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${serviceName}</span></div>
      <div class="detail-row"><span class="detail-label">Doctor</span><span class="detail-value">${doctorName || 'To be assigned'}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value"><strong>${new Date(bookingDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value"><strong>${startTime?.slice(0,5)} – ${endTime?.slice(0,5)}</strong></span></div>
      <div class="detail-row"><span class="detail-label">Location</span><span class="detail-value">${clinicAddress || clinicName}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-confirmed">Confirmed</span></span></div>
    </div>

    <div class="warning-box">
      <strong>📌 Reminder:</strong> Please arrive 10 minutes before your appointment time.
    </div>
  `, clinicName, clinicEmail);

  await sendEmail({ to, subject: `Appointment Confirmed — ${bookingDate} at ${startTime?.slice(0,5)}`, html });
};

// 3. Booking cancelled — to patient
exports.sendBookingCancelled = async ({ to, patientName, serviceName, bookingDate, startTime, reason, bookingId, clinicName, clinicEmail }) => {
  const html = baseTemplate(`
    <h2 style="color: #dc2626; margin-top: 0;">Appointment Cancelled ❌</h2>
    <p>Hi <strong>${patientName}</strong>, your appointment has been cancelled.</p>

    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Booking #</span><span class="detail-value">#${bookingId}</span></div>
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${serviceName}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${new Date(bookingDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${startTime?.slice(0,5)}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-cancelled">Cancelled</span></span></div>
      ${reason ? `<div class="detail-row"><span class="detail-label">Reason</span><span class="detail-value">${reason}</span></div>` : ''}
    </div>

    <p style="color: #6b5a58; font-size: 14px;">If you have any questions, please contact us. We'd be happy to reschedule.</p>
  `, clinicName, clinicEmail);

  await sendEmail({ to, subject: `Appointment Cancelled — Booking #${bookingId}`, html });
};

// 4. Booking reassigned — to patient
exports.sendBookingReassigned = async ({ to, patientName, serviceName, newDoctorName, newDate, newTime, bookingId, clinicName, clinicEmail }) => {
  const html = baseTemplate(`
    <h2 style="color: #d97706; margin-top: 0;">Appointment Rescheduled — Action Required ⏰</h2>
    <p>Hi <strong>${patientName}</strong>, your appointment has been rescheduled. Please confirm or decline the new time.</p>

    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Booking #</span><span class="detail-value">#${bookingId}</span></div>
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${serviceName}</span></div>
      <div class="detail-row"><span class="detail-label">New Doctor</span><span class="detail-value">${newDoctorName || 'To be assigned'}</span></div>
      <div class="detail-row"><span class="detail-label">New Date</span><span class="detail-value"><strong>${new Date(newDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></span></div>
      <div class="detail-row"><span class="detail-label">New Time</span><span class="detail-value"><strong>${newTime?.slice(0,5)}</strong></span></div>
    </div>

    <div class="warning-box">
      <strong>⚠️ Action Required:</strong> Please log in to your account and go to <strong>My Bookings</strong> to accept or decline this reschedule.
    </div>
  `, clinicName, clinicEmail);

  await sendEmail({ to, subject: `Action Required — Appointment Rescheduled #${bookingId}`, html });
};

// 5. Doctor notes added — to patient
exports.sendDoctorNote = async ({ to, patientName, doctorName, serviceName, bookingDate, notes, clinicName, clinicEmail }) => {
  const html = baseTemplate(`
    <h2 style="color: #2a1a18; margin-top: 0;">Note from Your Doctor 📋</h2>
    <p>Hi <strong>${patientName}</strong>, <strong>${doctorName}</strong> has added a note to your appointment.</p>

    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Appointment</span><span class="detail-value">${serviceName} on ${new Date(bookingDate).toLocaleDateString('en-GB')}</span></div>
      <div class="detail-row"><span class="detail-label">Doctor</span><span class="detail-value">${doctorName}</span></div>
    </div>

    <div class="note-box">
      <strong style="color: #059669;">📝 Doctor's Note:</strong>
      <p style="margin: 8px 0 0; color: #374151; line-height: 1.6;">${notes}</p>
    </div>

    <p style="color: #6b5a58; font-size: 14px;">If you have any questions about this note, please contact us or book a follow-up appointment.</p>
  `, clinicName, clinicEmail);

  await sendEmail({ to, subject: `Note from ${doctorName} — ${serviceName}`, html });
};

// 6. New booking — to doctor
exports.sendNewBookingToDoctor = async ({ to, doctorName, patientName, serviceName, bookingDate, startTime, endTime, notes, clinicName, clinicEmail }) => {
  const html = baseTemplate(`
    <h2 style="color: #2a1a18; margin-top: 0;">New Appointment Assigned 🩺</h2>
    <p>Hi <strong>Dr. ${doctorName}</strong>, a new appointment has been booked with you.</p>

    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Patient</span><span class="detail-value">${patientName}</span></div>
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${serviceName}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value"><strong>${new Date(bookingDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value"><strong>${startTime?.slice(0,5)} – ${endTime?.slice(0,5)}</strong></span></div>
      ${notes ? `<div class="detail-row"><span class="detail-label">Patient Notes</span><span class="detail-value fst-italic">"${notes}"</span></div>` : ''}
    </div>

    <p style="color: #6b5a58; font-size: 14px;">Please log in to your dashboard to confirm or manage this appointment.</p>
  `, clinicName, clinicEmail);

  await sendEmail({ to, subject: `New Appointment — ${patientName} on ${bookingDate}`, html });
};

// 7. New booking — to admin
exports.sendNewBookingToAdmin = async ({ to, patientName, serviceName, doctorName, bookingDate, startTime, bookingId, clinicName }) => {
  const html = baseTemplate(`
    <h2 style="color: #2a1a18; margin-top: 0;">New Booking Received 📅</h2>
    <p>A new appointment has been made.</p>

    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Booking #</span><span class="detail-value">#${bookingId}</span></div>
      <div class="detail-row"><span class="detail-label">Patient</span><span class="detail-value">${patientName}</span></div>
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${serviceName}</span></div>
      <div class="detail-row"><span class="detail-label">Doctor</span><span class="detail-value">${doctorName || 'To be assigned'}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${new Date(bookingDate).toLocaleDateString('en-GB')}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${startTime?.slice(0,5)}</span></div>
    </div>
  `, clinicName);

  await sendEmail({ to, subject: `New Booking #${bookingId} — ${patientName}`, html });
};

// 8. New contact message — to admin
exports.sendContactMessageToAdmin = async ({ to, senderName, senderEmail, message, clinicName }) => {
  const html = baseTemplate(`
    <h2 style="color: #2a1a18; margin-top: 0;">New Contact Message 📩</h2>
    <p>Someone sent a message through the contact form.</p>

    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">From</span><span class="detail-value">${senderName}</span></div>
      <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value"><a href="mailto:${senderEmail}">${senderEmail}</a></span></div>
    </div>

    <div class="note-box">
      <strong>Message:</strong>
      <p style="margin: 8px 0 0; color: #374151; line-height: 1.6;">${message}</p>
    </div>

    <a href="mailto:${senderEmail}?subject=Re: Your message" class="btn">Reply to ${senderName}</a>
  `, clinicName);

  await sendEmail({ to, subject: `New Contact Message from ${senderName}`, html });
};
