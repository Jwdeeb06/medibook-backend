const { db } = require('../config/db');

// GET /api/export/bookings — returns JSON formatted for Excel export
exports.exportBookings = async (req, res, next) => {
  try {
    const { start_date, end_date, status, doctor_id } = req.query;

    let query = `
      SELECT
        b.id AS 'Booking ID',
        COALESCE(u.name, b.guest_name) AS 'Patient Name',
        COALESCE(u.email, b.guest_email) AS 'Patient Email',
        COALESCE(u.phone, b.guest_phone) AS 'Patient Phone',
        s.name AS 'Service',
        s.price AS 'Price ($)',
        d.name AS 'Doctor',
        d.specialization AS 'Specialization',
        DATE_FORMAT(b.booking_date, '%d/%m/%Y') AS 'Date',
        TIME_FORMAT(b.start_time, '%H:%i') AS 'Start Time',
        TIME_FORMAT(b.end_time, '%H:%i') AS 'End Time',
        b.status AS 'Status',
        b.notes AS 'Patient Notes',
        b.doctor_notes AS 'Doctor Notes',
        DATE_FORMAT(b.created_at, '%d/%m/%Y %H:%i') AS 'Booked At'
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) { query += ` AND b.booking_date >= ?`; params.push(start_date); }
    if (end_date) { query += ` AND b.booking_date <= ?`; params.push(end_date); }
    if (status) { query += ` AND b.status = ?`; params.push(status); }
    if (doctor_id) { query += ` AND b.doctor_id = ?`; params.push(doctor_id); }

    query += ` ORDER BY b.booking_date DESC, b.start_time DESC`;

    const [rows] = await db.query(query, params);
    res.json({ count: rows.length, data: rows });
  } catch (error) { next(error); }
};

// GET /api/export/patients
exports.exportPatients = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        u.id AS 'ID',
        u.name AS 'Name',
        u.email AS 'Email',
        u.phone AS 'Phone',
        u.gender AS 'Gender',
        u.date_of_birth AS 'Date of Birth',
        IF(u.is_active, 'Active', 'Inactive') AS 'Status',
        COUNT(b.id) AS 'Total Bookings',
        COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_price ELSE 0 END), 0) AS 'Total Spent ($)',
        DATE_FORMAT(u.created_at, '%d/%m/%Y') AS 'Member Since'
      FROM users u
      LEFT JOIN bookings b ON b.user_id = u.id
      WHERE u.role = 'patient'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ count: rows.length, data: rows });
  } catch (error) { next(error); }
};
