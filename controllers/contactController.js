const { db } = require('../config/db');
const { createNotification } = require('./notificationController');

exports.sendMessage = async (req, res, next) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message)
      return res.status(400).json({ error: 'Name, email and message are required' });

    await db.query(
      'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)',
      [name, email, message]
    );

    const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE");
    for (const admin of admins) {
      await createNotification(
        admin.id,
        `📩 New Contact Message from ${name}`,
        `${email} says: "${message.slice(0, 120)}${message.length > 120 ? '...' : ''}"`,
        'system'
      );
    }

    res.json({ message: 'Message sent successfully' });
  } catch (error) { next(error); }
};

exports.getMessages = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    const [[{ unread }]] = await db.query('SELECT COUNT(*) AS unread FROM contact_messages WHERE is_read = FALSE');
    res.json({ count: rows.length, unread, messages: rows });
  } catch (error) { next(error); }
};

exports.markRead = async (req, res, next) => {
  try {
    await db.query('UPDATE contact_messages SET is_read = TRUE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Marked as read' });
  } catch (error) { next(error); }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    await db.query('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) { next(error); }
};