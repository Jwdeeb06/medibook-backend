const { db } = require('../config/db');

exports.getAllBookings = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT b.*,
             u.name AS patient_name,
             d.name AS doctor_name,
             s.name AS service_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN doctors d ON b.doctor_id = d.id
      JOIN services s ON b.service_id = s.id
      ORDER BY b.booking_date DESC, b.start_time DESC
    `);
    res.json({ count: rows.length, bookings: rows });
  } catch (error) {
    next(error);
  }
};

exports.createBooking = async (req, res) => {
  // Full booking creation comes in Week 2 with auth + slot validation
  res.status(501).json({ message: 'Create booking — coming in Week 2' });
};
