const { db } = require('../config/db');

exports.getStats = async (req, res, next) => {
  try {
    const [[{ total_services }]] = await db.query("SELECT COUNT(*) AS total_services FROM services WHERE is_active = TRUE");
    const [[{ total_bookings }]] = await db.query("SELECT COUNT(*) AS total_bookings FROM bookings");
    const [[{ pending_bookings }]] = await db.query("SELECT COUNT(*) AS pending_bookings FROM bookings WHERE status = 'pending'");
    const [[{ confirmed_bookings }]] = await db.query("SELECT COUNT(*) AS confirmed_bookings FROM bookings WHERE status = 'confirmed'");
    const [[{ total_patients }]] = await db.query("SELECT COUNT(*) AS total_patients FROM users WHERE role = 'patient'");
    const [[{ total_doctors }]] = await db.query("SELECT COUNT(*) AS total_doctors FROM doctors WHERE is_active = TRUE");
    const [[{ completed_bookings }]] = await db.query("SELECT COUNT(*) AS completed_bookings FROM bookings WHERE status = 'completed'");

    const [recent_bookings] = await db.query(`
      SELECT b.id, b.booking_date, b.start_time, b.status,
        COALESCE(u.name, b.guest_name) AS customer_name,
        s.name AS service_name, d.name AS doctor_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      ORDER BY b.created_at DESC LIMIT 8
    `);

    res.json({ total_services, total_bookings, pending_bookings, confirmed_bookings,
               total_patients, total_doctors, completed_bookings, recent_bookings });
  } catch (error) { next(error); }
};

// GET /api/admins/patients
exports.getAllPatients = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, phone, gender, is_active, created_at FROM users WHERE role = 'patient' ORDER BY created_at DESC"
    );
    res.json({ count: rows.length, patients: rows });
  } catch (error) { next(error); }
};

// PUT /api/admins/patients/:id/toggle
exports.togglePatient = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT is_active FROM users WHERE id = ? AND role = "patient"', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [!rows[0].is_active, req.params.id]);
    res.json({ message: 'Patient status updated' });
  } catch (error) { next(error); }
};
