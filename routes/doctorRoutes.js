const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticateToken, requireAdmin, requireAdminOrDoctor } = require('../middleware/auth');

// Public
router.get('/', doctorController.getAllDoctors);
router.get('/by-service/:serviceId', doctorController.getDoctorsByService);

// Doctor — own profile
router.get('/me', authenticateToken, requireAdminOrDoctor, doctorController.getMyProfile);

// Single doctor
router.get('/:id', doctorController.getDoctorById);

// Admin only — create/delete
router.post('/', authenticateToken, requireAdmin, doctorController.createDoctor);
router.delete('/:id', authenticateToken, requireAdmin, doctorController.deleteDoctor);

// Admin or Doctor — update
router.put('/:id', authenticateToken, requireAdminOrDoctor, doctorController.updateDoctor);
router.put('/:id/services', authenticateToken, requireAdminOrDoctor, doctorController.updateDoctorServices);
router.put('/:id/schedule', authenticateToken, requireAdminOrDoctor, doctorController.updateSchedule);

module.exports = router;
