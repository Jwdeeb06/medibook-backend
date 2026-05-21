const { db } = require('../config/db');

// GET /api/patients/:id/history — full medical history for a patient
exports.getPatientHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Patient info
    const [users] = await db.query(
      'SELECT id, name, email, phone, gender, date_of_birth, created_at FROM users WHERE id = ? AND role = "patient"',
      [id]
    );
    if (users.length === 0) return res.status(404).json({ error: 'Patient not found' });

    // All bookings with doctor notes
    const [bookings] = await db.query(
      `SELECT b.*,
              d.name AS doctor_name, d.specialization,
              s.name AS service_name, s.price
       FROM bookings b
       LEFT JOIN doctors d ON b.doctor_id = d.id
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.user_id = ?
       ORDER BY b.booking_date DESC, b.start_time DESC`,
      [id]
    );

    // Stats
    const totalSpent = bookings
      .filter(b => ['confirmed', 'completed'].includes(b.status))
      .reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

    const mostVisitedDoctor = bookings.reduce((acc, b) => {
      if (!b.doctor_name) return acc;
      acc[b.doctor_name] = (acc[b.doctor_name] || 0) + 1;
      return acc;
    }, {});

    const topDoctor = Object.entries(mostVisitedDoctor).sort((a, b) => b[1] - a[1])[0];

    res.json({
      patient: users[0],
      stats: {
        total_appointments: bookings.length,
        completed: bookings.filter(b => b.status === 'completed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length,
        total_spent: totalSpent.toFixed(2),
        top_doctor: topDoctor ? topDoctor[0] : null,
        member_since: users[0].created_at,
      },
      bookings,
    });
  } catch (error) { next(error); }
};

// GET /api/patients — all patients with basic info (admin)
exports.getAllPatients = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.phone, u.gender, u.is_active, u.created_at,
             COUNT(b.id) AS total_bookings,
             COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_price ELSE 0 END), 0) AS total_spent
      FROM users u
      LEFT JOIN bookings b ON b.user_id = u.id
      WHERE u.role = 'patient'
    `;
    const params = [];
    if (search) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    query += ` GROUP BY u.id ORDER BY u.created_at DESC`;

    const [rows] = await db.query(query, params);
    res.json({ count: rows.length, patients: rows });
  } catch (error) { next(error); }
};
