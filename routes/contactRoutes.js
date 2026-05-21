const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.post('/', contactController.sendMessage);
router.get('/', authenticateToken, requireAdmin, contactController.getMessages);
router.put('/:id/read', authenticateToken, requireAdmin, contactController.markRead);
router.delete('/:id', authenticateToken, requireAdmin, contactController.deleteMessage);

module.exports = router;