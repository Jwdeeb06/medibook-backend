const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/stats', authenticateToken, requireAdmin, adminController.getStats);
router.get('/patients', authenticateToken, requireAdmin, adminController.getAllPatients);
router.put('/patients/:id/toggle', authenticateToken, requireAdmin, adminController.togglePatient);

module.exports = router;
