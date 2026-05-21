const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken, requireAdmin, requireAdminOrDoctor } = require('../middleware/auth');

router.get('/', authenticateToken, notificationController.getNotifications);
router.put('/read-all', authenticateToken, notificationController.markAllRead);
router.put('/:id/read', authenticateToken, notificationController.markRead);
router.post('/send', authenticateToken, requireAdminOrDoctor, notificationController.sendToUser);
router.post('/broadcast', authenticateToken, requireAdmin, notificationController.broadcast);

module.exports = router;