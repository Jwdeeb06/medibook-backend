const { db } = require('../config/db');

// Get all settings as key-value object
exports.getSettings = async () => {
  try {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
    return rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});
  } catch {
    return {};
  }
};
