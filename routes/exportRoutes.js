const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/bookings', authenticateToken, requireAdmin, exportController.exportBookings);
router.get('/patients', authenticateToken, requireAdmin, exportController.exportPatients);

module.exports = router;
