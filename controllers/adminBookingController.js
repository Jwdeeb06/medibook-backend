const { db } = require('../config/db');
const bcrypt = require('bcrypt');
const { createNotification } = require('./notificationController');
const email = require('../utils/emailService');
const { getSettings } = require('../utils/settingsHelper');

// POST /api/bookings/admin-create
exports.adminCreateBooking = async (req, res, next) => {
  try {
    const {
      // Patient type: 'existing' | 'guest' | 'new'
      patient_type,
      // Existing patient
      user_id,
      // Guest fields
      guest_name, guest_email, guest_phone,
      // New patient fields
      new_name, new_email, new_phone, new_password, new_gender,
      // Booking fields
      service_id, doctor_id, booking_date, start_time, notes,
    } = req.body;

    if (!service_id || !booking_date || !start_time)
      return res.status(400).json({ error: 'Service, date and time are required' });

    const settings = await getSettings();
    let finalUserId = null;
    let patientName, patientEmail, patientPhone;

    // ── Resolve patient ──────────────────────────────────
    if (patient_type === 'existing') {
      if (!user_id) return res.status(400).json({ error: 'Please select a patient' });
      const [users] = await db.query('SELECT * FROM users WHERE id = ? AND role = "patient"', [user_id]);
      if (users.length === 0) return res.status(404).json({ error: 'Patient not found' });
      finalUserId = user_id;
      patientName = users[0].name;
      patientEmail = users[0].email;
      patientPhone = users[0].phone;

    } else if (patient_type === 'guest') {
      if (!guest_name || !guest_email)
        return res.status(400).json({ error: 'Guest name and email are required' });
      patientName = guest_name;
      patientEmail = guest_email;
      patientPhone = guest_phone;

    } else if (patient_type === 'new') {
      if (!new_name || !new_email || !new_password)
        return res.status(400).json({ error: 'Name, email and password are required for new patient' });
      const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [new_email]);
      if (existing.length > 0)
        return res.status(409).json({ error: 'Email already registered — use "Existing Patient"' });
      const hashed = await bcrypt.hash(new_password, 12);
      const [result] = await db.query(
        `INSERT INTO users (name, email, password, phone, gender, role) VALUES (?, ?, ?, ?, ?, 'patient')`,
        [new_name, new_email, hashed, new_phone || null, new_gender || null]
      );
      finalUserId = result.insertId;
      patientName = new_name;
      patientEmail = new_email;
      patientPhone = new_phone;
    } else {
      return res.status(400).json({ error: 'Invalid patient_type' });
    }

    // ── Get service ──────────────────────────────────────
    const [services] = await db.query('SELECT * FROM services WHERE id = ? AND is_active = TRUE', [service_id]);
    if (services.length === 0) return res.status(404).json({ error: 'Service not found' });
    const service = services[0];

    // ── Compute end time ─────────────────────────────────
    const [hours, minutes] = start_time.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, hours, minutes + service.duration_minutes);
    const end_time = `${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}:00`;

    // ── Resolve doctor ───────────────────────────────────
    let finalDoctorId = doctor_id || null;
    if (!finalDoctorId) {
      const [docs] = await db.query(
        `SELECT d.id FROM doctors d INNER JOIN doctor_services ds ON ds.doctor_id = d.id
         WHERE ds.service_id = ? AND d.is_active = TRUE`, [service_id]
      );
      for (const doc of docs) {
        const [conflicts] = await db.query(
          `SELECT id FROM bookings WHERE doctor_id = ? AND booking_date = ?
           AND status NOT IN ('cancelled') AND start_time < ? AND end_time > ?`,
          [doc.id, booking_date, end_time, start_time]
        );
        if (conflicts.length === 0) { finalDoctorId = doc.id; break; }
      }
    } else {
      const [conflicts] = await db.query(
        `SELECT id FROM bookings WHERE doctor_id = ? AND booking_date = ?
         AND status NOT IN ('cancelled') AND start_time < ? AND end_time > ?`,
        [finalDoctorId, booking_date, end_time, start_time]
      );
      if (conflicts.length > 0)
        return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // ── Get doctor info ──────────────────────────────────
    let doctorInfo = null;
    if (finalDoctorId) {
      const [docRows] = await db.query('SELECT name, email FROM doctors WHERE id = ?', [finalDoctorId]);
      doctorInfo = docRows[0];
    }

    // ── Insert booking (admin bookings are auto-confirmed) ──
    const [result] = await db.query(
      `INSERT INTO bookings (user_id, guest_name, guest_email, guest_phone, doctor_id, service_id,
        booking_date, start_time, end_time, notes, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
      [
        finalUserId,
        finalUserId ? null : patientName,
        finalUserId ? null : patientEmail,
        finalUserId ? null : patientPhone,
        finalDoctorId, service_id, booking_date, start_time, end_time,
        notes || null, service.price,
      ]
    );

    const bookingId = result.insertId;

    // ── Send email to patient ─────────────────────────────
    if (patientEmail) {
      await email.sendBookingConfirmed({
        to: patientEmail,
        patientName,
        serviceName: service.name,
        doctorName: doctorInfo?.name,
        bookingDate: booking_date,
        startTime: start_time,
        endTime: end_time,
        bookingId,
        clinicName: settings.site_name || 'MediBook',
        clinicEmail: settings.contact_email,
        clinicAddress: settings.contact_address,
      });
    }

    // ── Send email to doctor ──────────────────────────────
    if (doctorInfo?.email) {
      await email.sendNewBookingToDoctor({
        to: doctorInfo.email,
        doctorName: doctorInfo.name,
        patientName,
        serviceName: service.name,
        bookingDate: booking_date,
        startTime: start_time,
        endTime: end_time,
        notes,
        clinicName: settings.site_name,
        clinicEmail: settings.contact_email,
      });
    }

    // ── In-app notification for existing patients ─────────
    if (finalUserId) {
      await createNotification(finalUserId,
        '✅ Appointment Booked by Clinic',
        `Your appointment for ${service.name} on ${booking_date} at ${start_time.slice(0,5)} has been confirmed by the clinic.`,
        'confirmation'
      );
    }

    const [booking] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    res.status(201).json({
      message: 'Booking created successfully',
      booking: booking[0],
      new_patient_created: patient_type === 'new',
    });
  } catch (error) { next(error); }
};
