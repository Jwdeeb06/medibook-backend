const { db } = require('../config/db');

// GET /api/services
exports.getAllServices = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM services WHERE is_active = TRUE ORDER BY category, name ASC'
    );
    res.json({ count: rows.length, services: rows });
  } catch (error) { next(error); }
};

// GET /api/services/:id
exports.getServiceById = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (rows.length === 0)
      return res.status(404).json({ error: 'Service not found' });
    res.json(rows[0]);
  } catch (error) { next(error); }
};

// POST /api/services (admin only)
exports.createService = async (req, res, next) => {
  try {
    const { name, description, price, duration_minutes, category } = req.body;

    if (!name || !price)
      return res.status(400).json({ error: 'Name and price are required' });

    const [result] = await db.query(
      `INSERT INTO services (name, description, price, duration_minutes, category)
       VALUES (?, ?, ?, ?, ?)`,
      [name, description || null, price, duration_minutes || 30, category || null]
    );

    const [rows] = await db.query('SELECT * FROM services WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Service created', service: rows[0] });
  } catch (error) { next(error); }
};

// PUT /api/services/:id (admin only)
exports.updateService = async (req, res, next) => {
  try {
    const { name, description, price, duration_minutes, category, is_active } = req.body;
    const { id } = req.params;

    const [existing] = await db.query('SELECT id FROM services WHERE id = ?', [id]);
    if (existing.length === 0)
      return res.status(404).json({ error: 'Service not found' });

    await db.query(
      `UPDATE services SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        duration_minutes = COALESCE(?, duration_minutes),
        category = COALESCE(?, category),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, description, price, duration_minutes, category, is_active, id]
    );

    const [rows] = await db.query('SELECT * FROM services WHERE id = ?', [id]);
    res.json({ message: 'Service updated', service: rows[0] });
  } catch (error) { next(error); }
};

// DELETE /api/services/:id (admin only — soft delete)
exports.deleteService = async (req, res, next) => {
  try {
    const [existing] = await db.query('SELECT id FROM services WHERE id = ?', [req.params.id]);
    if (existing.length === 0)
      return res.status(404).json({ error: 'Service not found' });

    // Soft delete — keeps booking history intact
    await db.query('UPDATE services SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Service deactivated successfully' });
  } catch (error) { next(error); }
};
