const { db } = require('../config/db');
const bcrypt = require('bcrypt');

exports.getAllDoctors = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM doctors WHERE is_active = TRUE ORDER BY name ASC');
    res.json({ count: rows.length, doctors: rows });
  } catch (error) { next(error); }
};

exports.getDoctorById = async (req, res, next) => {
  try {
    const [doctorRows] = await db.query('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
    if (doctorRows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
    const [services] = await db.query(
      `SELECT s.* FROM services s INNER JOIN doctor_services ds ON ds.service_id = s.id
       WHERE ds.doctor_id = ? AND s.is_active = TRUE`, [req.params.id]
    );
    const [schedules] = await db.query(
      'SELECT * FROM schedules WHERE doctor_id = ? ORDER BY day_of_week', [req.params.id]
    );
    res.json({ ...doctorRows[0], services, schedules });
  } catch (error) { next(error); }
};

exports.getDoctorsByService = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT d.* FROM doctors d INNER JOIN doctor_services ds ON ds.doctor_id = d.id
       WHERE ds.service_id = ? AND d.is_active = TRUE ORDER BY d.name ASC`,
      [req.params.serviceId]
    );
    res.json({ count: rows.length, doctors: rows });
  } catch (error) { next(error); }
};

exports.getMyProfile = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM doctors WHERE user_id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Doctor profile not found' });
    const [services] = await db.query(
      `SELECT s.* FROM services s INNER JOIN doctor_services ds ON ds.service_id = s.id
       WHERE ds.doctor_id = ?`, [rows[0].id]
    );
    const [schedules] = await db.query(
      'SELECT * FROM schedules WHERE doctor_id = ? ORDER BY day_of_week', [rows[0].id]
    );
    res.json({ ...rows[0], services, schedules });
  } catch (error) { next(error); }
};

exports.createDoctor = async (req, res, next) => {
  try {
    const { name, specialization, bio, email, phone, years_experience, password } = req.body;
    if (!name || !specialization || !email || !password)
      return res.status(400).json({ error: 'Name, specialization, email and password are required' });

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const [userResult] = await db.query(
      `INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, 'doctor')`,
      [name, email, hashedPassword, phone || null]
    );
    const [doctorResult] = await db.query(
      `INSERT INTO doctors (user_id, name, specialization, bio, email, phone, years_experience)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userResult.insertId, name, specialization, bio || null, email, phone || null, years_experience || 0]
    );
    const [doctor] = await db.query('SELECT * FROM doctors WHERE id = ?', [doctorResult.insertId]);
    res.status(201).json({ message: 'Doctor created successfully', doctor: doctor[0] });
  } catch (error) { next(error); }
};

exports.updateDoctor = async (req, res, next) => {
  try {
    const { name, specialization, bio, phone, years_experience } = req.body;
    const { id } = req.params;
    if (req.user.role === 'doctor') {
      const [mine] = await db.query('SELECT id FROM doctors WHERE id = ? AND user_id = ?', [id, req.user.id]);
      if (mine.length === 0) return res.status(403).json({ error: 'Not your profile' });
    }
    await db.query(
      `UPDATE doctors SET name = COALESCE(?, name), specialization = COALESCE(?, specialization),
       bio = COALESCE(?, bio), phone = COALESCE(?, phone), years_experience = COALESCE(?, years_experience)
       WHERE id = ?`,
      [name, specialization, bio, phone, years_experience, id]
    );
    const [updated] = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);
    res.json({ message: 'Doctor updated', doctor: updated[0] });
  } catch (error) { next(error); }
};

exports.deleteDoctor = async (req, res, next) => {
  try {
    const [existing] = await db.query('SELECT id FROM doctors WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Doctor not found' });
    await db.query('UPDATE doctors SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Doctor deactivated' });
  } catch (error) { next(error); }
};

exports.updateDoctorServices = async (req, res, next) => {
  try {
    const { service_ids } = req.body;
    const { id } = req.params;
    if (req.user.role === 'doctor') {
      const [mine] = await db.query('SELECT id FROM doctors WHERE id = ? AND user_id = ?', [id, req.user.id]);
      if (mine.length === 0) return res.status(403).json({ error: 'Not your profile' });
    }
    await db.query('DELETE FROM doctor_services WHERE doctor_id = ?', [id]);
    if (service_ids && service_ids.length > 0) {
      const values = service_ids.map(sid => [parseInt(id), parseInt(sid)]);
      await db.query('INSERT INTO doctor_services (doctor_id, service_id) VALUES ?', [values]);
    }
    res.json({ message: 'Services updated' });
  } catch (error) { next(error); }
};

exports.updateSchedule = async (req, res, next) => {
  try {
    const { schedules } = req.body;
    const { id } = req.params;
    if (req.user.role === 'doctor') {
      const [mine] = await db.query('SELECT id FROM doctors WHERE id = ? AND user_id = ?', [id, req.user.id]);
      if (mine.length === 0) return res.status(403).json({ error: 'Not your schedule' });
    }
    await db.query('DELETE FROM schedules WHERE doctor_id = ?', [id]);
    if (schedules && schedules.length > 0) {
      const values = schedules.map(s => [id, s.day_of_week, s.start_time, s.end_time, s.is_available !== false]);
      await db.query('INSERT INTO schedules (doctor_id, day_of_week, start_time, end_time, is_available) VALUES ?', [values]);
    }
    const [updated] = await db.query('SELECT * FROM schedules WHERE doctor_id = ? ORDER BY day_of_week', [id]);
    res.json({ message: 'Schedule updated', schedules: updated });
  } catch (error) { next(error); }
};
