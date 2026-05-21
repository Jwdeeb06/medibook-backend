const { db } = require('../config/db');

exports.getNotifications = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
      [req.user.id]
    );
    const [[{ unread }]] = await db.query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ notifications: rows, unread });
  } catch (error) { next(error); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All marked as read' });
  } catch (error) { next(error); }
};

exports.markRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (error) { next(error); }
};

exports.sendToUser = async (req, res, next) => {
  try {
    const { user_id, title, message } = req.body;
    if (!user_id || !title || !message)
      return res.status(400).json({ error: 'user_id, title and message are required' });

    const [users] = await db.query(
      "SELECT id, name FROM users WHERE id = ? AND role = 'patient'", [user_id]
    );
    if (users.length === 0)
      return res.status(404).json({ error: 'Patient not found' });

    await exports.createNotification(user_id, title, message, 'system');
    res.json({ message: `Notification sent to ${users[0].name}` });
  } catch (error) { next(error); }
};

exports.broadcast = async (req, res, next) => {
  try {
    const { title, message } = req.body;
    if (!title || !message)
      return res.status(400).json({ error: 'Title and message are required' });

    const [patients] = await db.query(
      "SELECT id FROM users WHERE role = 'patient' AND is_active = TRUE"
    );
    for (const patient of patients) {
      await exports.createNotification(patient.id, title, message, 'system');
    }
    res.json({ message: `Broadcast sent to ${patients.length} patients` });
  } catch (error) { next(error); }
};

exports.createNotification = async (userId, title, message, type = 'system') => {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [userId, title, message, type]
    );
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};