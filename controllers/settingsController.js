const { db } = require('../config/db');

// GET /api/settings — return all settings as a key-value object
exports.getAllSettings = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
    // Convert to a flat object: { site_name: 'MediBook', contact_email: '...' }
    const settings = rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

// PUT /api/settings/:key — update a single setting (admin only — auth in Week 2)
exports.updateSetting = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    await db.query(
      `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value]
    );

    res.json({ key, value, message: 'Setting updated' });
  } catch (error) {
    next(error);
  }
};
