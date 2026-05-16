const { db } = require('../config/db');
const bcrypt = require('bcrypt');

// GET /api/users (admin only)
exports.getAllUsers = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, phone, role, gender, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ count: rows.length, users: rows });
  } catch (error) { next(error); }
};

// GET /api/users/:id (admin only)
exports.getUserById = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, phone, role, gender, date_of_birth, is_active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) { next(error); }
};

// PUT /api/users/:id — patient updates their own profile
exports.updateUser = async (req, res, next) => {
  try {
    const { name, phone, gender, date_of_birth } = req.body;
    const { id } = req.params;

    // Patients can only update themselves
    if (req.user.role === 'patient' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.query(
      `UPDATE users SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        gender = COALESCE(?, gender),
        date_of_birth = COALESCE(?, date_of_birth)
       WHERE id = ?`,
      [name, phone, gender, date_of_birth, id]
    );

    const [rows] = await db.query(
      'SELECT id, name, email, phone, role, gender, date_of_birth FROM users WHERE id = ?',
      [id]
    );
    res.json({ message: 'Profile updated', user: rows[0] });
  } catch (error) { next(error); }
};
