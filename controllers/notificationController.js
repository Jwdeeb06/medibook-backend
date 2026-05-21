const { db } = require('../config/db');

// GET /api/notifications — get user's notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    const [[{ unread }]] = await db.query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ notifications: rows, unread });
  } catch (error) { next(error); }
};

// PUT /api/notifications/read-all — mark all as read
exports.markAllRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) { next(error); }
};

// PUT /api/notifications/:id/read
exports.markRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) { next(error); }
};

// Internal helper — create a notification (used by booking controller)
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
