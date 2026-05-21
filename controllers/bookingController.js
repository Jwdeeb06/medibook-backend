const { db } = require('../config/db');
const { createNotification } = require('./notificationController');

exports.getAllBookings = async (req, res, next) => {
  try {
    const { search, status, doctor_id, date } = req.query;
    let query = `
      SELECT b.*,
        COALESCE(u.name, b.guest_name) AS customer_name,
        COALESCE(u.email, b.guest_email) AS customer_email,
        COALESCE(u.phone, b.guest_phone) AS customer_phone,
        d.name AS doctor_name, d.specialization,
        s.name AS service_name, s.price AS service_price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (u.name LIKE ? OR b.guest_name LIKE ? OR u.email LIKE ? OR b.guest_email LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) { query += ` AND b.status = ?`; params.push(status); }
    if (doctor_id) { query += ` AND b.doctor_id = ?`; params.push(doctor_id); }
    if (date) { query += ` AND b.booking_date = ?`; params.push(date); }

    query += ` ORDER BY b.booking_date DESC, b.start_time DESC`;

    const [rows] = await db.query(query, params);
    res.json({ count: rows.length, bookings: rows });
  } catch (error) { next(error); }
};

exports.getBookingById = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT b.*,
        COALESCE(u.name, b.guest_name) AS customer_name,
        COALESCE(u.email, b.guest_email) AS customer_email,
        COALESCE(u.phone, b.guest_phone) AS customer_phone,
        d.name AS doctor_name, s.name AS service_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = ?`, [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (error) { next(error); }
};

exports.getMyBookings = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT b.*, d.name AS doctor_name, d.specialization,
             s.name AS service_name, s.price
      FROM bookings b
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.user_id = ?
      ORDER BY b.booking_date DESC`, [req.user.id]
    );
    res.json({ count: rows.length, bookings: rows });
  } catch (error) { next(error); }
};

exports.getDoctorBookings = async (req, res, next) => {
  try {
    const [doctorRows] = await db.query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
    if (doctorRows.length === 0) return res.status(404).json({ error: 'Doctor profile not found' });

    const { status, date } = req.query;
    let query = `
      SELECT b.*,
        COALESCE(u.name, b.guest_name) AS patient_name,
        COALESCE(u.phone, b.guest_phone) AS patient_phone,
        COALESCE(u.email, b.guest_email) AS patient_email,
        s.name AS service_name, s.price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.doctor_id = ?
    `;
    const params = [doctorRows[0].id];
    if (status) { query += ` AND b.status = ?`; params.push(status); }
    if (date) { query += ` AND b.booking_date = ?`; params.push(date); }
    query += ` ORDER BY b.booking_date DESC, b.start_time DESC`;

    const [rows] = await db.query(query, params);
    res.json({ count: rows.length, bookings: rows });
  } catch (error) { next(error); }
};

exports.createBooking = async (req, res, next) => {
  try {
    const { guest_name, guest_email, guest_phone, service_id, doctor_id, booking_date, start_time, notes } = req.body;
    const user_id = req.user?.id || null;

    if (!user_id && (!guest_name || !guest_email || !guest_phone))
      return res.status(400).json({ error: 'Guest bookings require name, email and phone' });

    if (!service_id || !booking_date || !start_time)
      return res.status(400).json({ error: 'Service, date and time are required' });

    const today = new Date().toISOString().split('T')[0];
    if (booking_date < today)
      return res.status(400).json({ error: 'Booking date cannot be in the past' });

    const [services] = await db.query('SELECT * FROM services WHERE id = ? AND is_active = TRUE', [service_id]);
    if (services.length === 0) return res.status(404).json({ error: 'Service not found' });
    const service = services[0];

    // Compute end_time
    const [hours, minutes] = start_time.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, hours, minutes + service.duration_minutes);
    const end_time = `${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}:00`;

    // Resolve doctor_id if "any available"
    let finalDoctorId = doctor_id || null;
    if (!finalDoctorId) {
      // Find first available doctor for this service + slot
      const [docs] = await db.query(
        `SELECT d.id FROM doctors d
         INNER JOIN doctor_services ds ON ds.doctor_id = d.id
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
      if (!finalDoctorId)
        return res.status(409).json({ error: 'No doctors available for this time slot' });
    } else {
      // Check conflict for chosen doctor
      const [conflicts] = await db.query(
        `SELECT id FROM bookings WHERE doctor_id = ? AND booking_date = ?
         AND status NOT IN ('cancelled') AND start_time < ? AND end_time > ?`,
        [finalDoctorId, booking_date, end_time, start_time]
      );
      if (conflicts.length > 0)
        return res.status(409).json({ error: 'This time slot is already booked' });
    }

    const [result] = await db.query(
      `INSERT INTO bookings (user_id, guest_name, guest_email, guest_phone, doctor_id, service_id,
        booking_date, start_time, end_time, notes, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [user_id, user_id ? null : guest_name, user_id ? null : guest_email, user_id ? null : guest_phone,
       finalDoctorId, service_id, booking_date, start_time, end_time, notes || null, service.price]
    );

    const [booking] = await db.query('SELECT * FROM bookings WHERE id = ?', [result.insertId]);

    // Send notification to patient if logged in
    if (user_id) {
      await createNotification(user_id,
        'Booking Received',
        `Your appointment for ${service.name} on ${booking_date} at ${start_time.slice(0,5)} has been received. We will confirm it shortly.`,
        'booking'
      );
    }

    res.status(201).json({ message: 'Appointment booked successfully', booking: booking[0] });
  } catch (error) { next(error); }
};

exports.updateBooking = async (req, res, next) => {
  try {
    const { status, notes, doctor_notes, doctor_id, booking_date, start_time, cancellation_reason } = req.body;
    const { id } = req.params;

    const [existing] = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = existing[0];

    if (req.user?.role === 'patient') {
      if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'Not your booking' });
      if (status && status !== 'cancelled') return res.status(403).json({ error: 'Patients can only cancel' });
    }

    // Handle reassignment — admin picks new doctor + time
    if ((doctor_id || booking_date || start_time) && req.user?.role === 'admin') {
      const newDoctorId = doctor_id || booking.doctor_id;
      const newDate = booking_date || booking.booking_date;
      const newStart = start_time || booking.start_time;

      const [services] = await db.query('SELECT duration_minutes FROM services WHERE id = ?', [booking.service_id]);
      const duration = services[0].duration_minutes;
      const [hours, minutes] = newStart.split(':').map(Number);
      const endDate = new Date(2000, 0, 1, hours, minutes + duration);
      const newEnd = `${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}:00`;

      // Check conflict (excluding current booking)
      const [conflicts] = await db.query(
        `SELECT id FROM bookings WHERE doctor_id = ? AND booking_date = ?
         AND status NOT IN ('cancelled') AND id != ? AND start_time < ? AND end_time > ?`,
        [newDoctorId, newDate, id, newEnd, newStart]
      );
      if (conflicts.length > 0)
        return res.status(409).json({ error: 'New time slot conflicts with existing booking' });

      await db.query(
        `UPDATE bookings SET doctor_id = ?, booking_date = ?, start_time = ?, end_time = ? WHERE id = ?`,
        [newDoctorId, newDate, newStart, newEnd, id]
      );
    }

    await db.query(
      `UPDATE bookings SET
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        doctor_notes = COALESCE(?, doctor_notes),
        cancellation_reason = COALESCE(?, cancellation_reason)
       WHERE id = ?`,
      [status, notes, doctor_notes, cancellation_reason, id]
    );

    // Notifications
    if (status === 'confirmed' && booking.user_id) {
      await createNotification(booking.user_id,
        'Appointment Confirmed ✅',
        `Your appointment on ${booking.booking_date} at ${String(booking.start_time).slice(0,5)} has been confirmed.`,
        'confirmation'
      );
    }
    if (status === 'cancelled' && booking.user_id) {
      await createNotification(booking.user_id,
        'Appointment Cancelled',
        `Your appointment on ${booking.booking_date} has been cancelled. ${cancellation_reason ? 'Reason: ' + cancellation_reason : ''}`,
        'cancellation'
      );
    }

    const [updated] = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
    res.json({ message: 'Booking updated', booking: updated[0] });
  } catch (error) { next(error); }
};

exports.deleteBooking = async (req, res, next) => {
  try {
    const [existing] = await db.query('SELECT id FROM bookings WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Booking not found' });
    await db.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ message: 'Booking deleted' });
  } catch (error) { next(error); }
};
