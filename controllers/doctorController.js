const { db } = require('../config/db');

// GET /api/doctors — list all active doctors
exports.getAllDoctors = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM doctors WHERE is_active = TRUE ORDER BY name ASC'
    );
    res.json({ count: rows.length, doctors: rows });
  } catch (error) {
    next(error);
  }
};

// GET /api/doctors/:id — single doctor with services + schedule
exports.getDoctorById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [doctorRows] = await db.query(
      'SELECT * FROM doctors WHERE id = ?',
      [id]
    );
    if (doctorRows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Fetch services this doctor offers
    const [services] = await db.query(
      `SELECT s.* FROM services s
       INNER JOIN doctor_services ds ON ds.service_id = s.id
       WHERE ds.doctor_id = ? AND s.is_active = TRUE`,
      [id]
    );

    // Fetch schedule
    const [schedules] = await db.query(
      'SELECT * FROM schedules WHERE doctor_id = ? ORDER BY day_of_week',
      [id]
    );

    res.json({
      ...doctorRows[0],
      services,
      schedules,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/doctors/by-service/:serviceId — doctors who offer a service
exports.getDoctorsByService = async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const [rows] = await db.query(
      `SELECT d.* FROM doctors d
       INNER JOIN doctor_services ds ON ds.doctor_id = d.id
       WHERE ds.service_id = ? AND d.is_active = TRUE
       ORDER BY d.name ASC`,
      [serviceId]
    );
    res.json({ count: rows.length, doctors: rows });
  } catch (error) {
    next(error);
  }
};
