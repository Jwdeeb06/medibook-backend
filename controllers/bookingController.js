const { db } = require('../config/db');

// GET /api/bookings
exports.getAllBookings = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        b.*,
        COALESCE(u.name, b.guest_name) AS customer_name,
        COALESCE(u.email, b.guest_email) AS customer_email,
        COALESCE(u.phone, b.guest_phone) AS customer_phone,
        d.name AS doctor_name,
        d.specialization,
        s.name AS service_name,
        s.price AS service_price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      ORDER BY b.booking_date DESC, b.start_time DESC
    `);
    res.json({ count: rows.length, bookings: rows });
  } catch (error) { next(error); }
};

// GET /api/bookings/:id
exports.getBookingById = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT b.*,
        COALESCE(u.name, b.guest_name) AS customer_name,
        COALESCE(u.email, b.guest_email) AS customer_email,
        d.name AS doctor_name,
        s.name AS service_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (error) { next(error); }
};

// GET /api/bookings/my — logged-in patient's own bookings
exports.getMyBookings = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT b.*, d.name AS doctor_name, s.name AS service_name, s.price
      FROM bookings b
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.user_id = ?
      ORDER BY b.booking_date DESC`,
      [req.user.id]
    );
    res.json({ count: rows.length, bookings: rows });
  } catch (error) { next(error); }
};

// POST /api/bookings — hybrid: works for guests AND logged-in patients
exports.createBooking = async (req, res, next) => {
  try {
    const {
      // Guest fields
      guest_name, guest_email, guest_phone,
      // Booking fields
      service_id, doctor_id,
      booking_date, start_time, notes,
    } = req.body;

    // user_id comes from JWT if logged in, null if guest
    const user_id = req.user?.id || null;

    // Validate: either logged-in OR guest fields provided
if (!user_id && (!guest_name || !guest_email || !guest_phone)) {
  return res.status(400).json({
    error: 'Guest bookings require name, email and phone',
    debug_user_id: user_id,
    debug_req_user: req.user || 'NO USER ATTACHED',
    debug_auth_header: req.headers['authorization'] || 'NO AUTH HEADER'
  });
}

    if (!service_id || !booking_date || !start_time) {
      return res.status(400).json({
        error: 'Service, date and time are required'
      });
    }

    // Validate booking date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (booking_date < today) {
      return res.status(400).json({ error: 'Booking date cannot be in the past' });
    }

    // Get service to compute end_time and price
    const [services] = await db.query(
      'SELECT * FROM services WHERE id = ? AND is_active = TRUE', [service_id]
    );
    if (services.length === 0)
      return res.status(404).json({ error: 'Service not found' });

    const service = services[0];

    // Compute end_time from start_time + duration
    const [hours, minutes] = start_time.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, hours, minutes + service.duration_minutes);
    const end_time = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;

    // Check for double-booking on same doctor + date + overlapping time
    if (doctor_id) {
      const [conflicts] = await db.query(`
        SELECT id FROM bookings
        WHERE doctor_id = ?
          AND booking_date = ?
          AND status NOT IN ('cancelled')
          AND start_time < ?
          AND end_time > ?`,
        [doctor_id, booking_date, end_time, start_time]
      );
      if (conflicts.length > 0) {
        return res.status(409).json({
          error: 'This time slot is already booked for the selected doctor'
        });
      }
    }

    const [result] = await db.query(
      `INSERT INTO bookings
        (user_id, guest_name, guest_email, guest_phone,
         doctor_id, service_id, booking_date, start_time, end_time,
         notes, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        user_id,
        user_id ? null : guest_name,
        user_id ? null : guest_email,
        user_id ? null : guest_phone,
        doctor_id || null,
        service_id,
        booking_date,
        start_time,
        end_time,
        notes || null,
        service.price,
      ]
    );

    const [booking] = await db.query('SELECT * FROM bookings WHERE id = ?', [result.insertId]);

    res.status(201).json({
      message: 'Appointment booked successfully',
      booking: booking[0],
    });
  } catch (error) { next(error); }
};

// PUT /api/bookings/:id — update status (admin) or cancel (patient)
exports.updateBooking = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const { id } = req.params;

    const [existing] = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (existing.length === 0)
      return res.status(404).json({ error: 'Booking not found' });

    // Patients can only cancel their own bookings
    if (req.user?.role === 'patient') {
      if (existing[0].user_id !== req.user.id)
        return res.status(403).json({ error: 'Not your booking' });
      if (status && status !== 'cancelled')
        return res.status(403).json({ error: 'Patients can only cancel bookings' });
    }

    await db.query(
      'UPDATE bookings SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?',
      [status, notes, id]
    );

    const [updated] = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
    res.json({ message: 'Booking updated', booking: updated[0] });
  } catch (error) { next(error); }
};

// DELETE /api/bookings/:id (admin only)
exports.deleteBooking = async (req, res, next) => {
  try {
    const [existing] = await db.query('SELECT id FROM bookings WHERE id = ?', [req.params.id]);
    if (existing.length === 0)
      return res.status(404).json({ error: 'Booking not found' });

    await db.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ message: 'Booking deleted' });
  } catch (error) { next(error); }
};

// GET /api/bookings/doctor — doctor sees their own appointments
exports.getDoctorBookings = async (req, res, next) => {
  try {
    const [doctorRows] = await db.query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
    if (doctorRows.length === 0) return res.status(404).json({ error: 'Doctor profile not found' });

    const [rows] = await db.query(`
      SELECT b.*,
        COALESCE(u.name, b.guest_name) AS patient_name,
        COALESCE(u.phone, b.guest_phone) AS patient_phone,
        s.name AS service_name, s.price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.doctor_id = ?
      ORDER BY b.booking_date DESC, b.start_time DESC`,
      [doctorRows[0].id]
    );
    res.json({ count: rows.length, bookings: rows });
  } catch (error) { next(error); }
};