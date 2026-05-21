const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone, date_of_birth, gender } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ error: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      `INSERT INTO users (name, email, password, phone, date_of_birth, gender, role)
       VALUES (?, ?, ?, ?, ?, ?, 'patient')`,
      [name, email, hashedPassword, phone || null, date_of_birth || null, gender || null]
    );
    const [users] = await db.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = ?',
      [result.insertId]
    );
    const token = generateToken(users[0]);
    res.status(201).json({ message: 'Registration successful', token, user: users[0] });
  } catch (error) { next(error); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]
    );
    if (users.length === 0)
      return res.status(401).json({ error: 'Invalid email or password' });
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: 'Invalid email or password' });
    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ message: 'Login successful', token, user: userWithoutPassword });
  } catch (error) { next(error); }
};

exports.getMe = async (req, res, next) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, phone, role, gender, date_of_birth, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0)
      return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (error) { next(error); }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ error: 'Both current and new password are required' });
    if (new_password.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0)
      return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(current_password, users[0].password);
    if (!isMatch)
      return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) { next(error); }
};

// PUT /api/auth/profile — update own profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, gender, date_of_birth } = req.body;
    await db.query(
      `UPDATE users SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        gender = COALESCE(?, gender),
        date_of_birth = COALESCE(?, date_of_birth)
       WHERE id = ?`,
      [name, phone, gender, date_of_birth, req.user.id]
    );
    const [users] = await db.query(
      'SELECT id, name, email, phone, role, gender, date_of_birth FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ message: 'Profile updated', user: users[0] });
  } catch (error) { next(error); }
};
