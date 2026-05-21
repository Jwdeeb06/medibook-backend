const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticateToken, requireAdmin, requireAdminOrDoctor } = require('../middleware/auth');

router.get('/', authenticateToken, requireAdmin, patientController.getAllPatients);
router.get('/:id/history', authenticateToken, requireAdminOrDoctor, patientController.getPatientHistory);

module.exports = router;
