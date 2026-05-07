const { db } = require('../config/db');

exports.getAllServices = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM services WHERE is_active = TRUE ORDER BY category, name ASC'
    );
    res.json({ count: rows.length, services: rows });
  } catch (error) {
    next(error);
  }
};

exports.getServiceById = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM services WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
};
