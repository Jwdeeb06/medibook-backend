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

// POST /api/auth/register
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
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
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
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, phone, role, gender, date_of_birth, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0)
      return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (error) {
    next(error);
  }
};
