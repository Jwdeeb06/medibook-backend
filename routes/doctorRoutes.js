const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticateToken, requireAdmin, requireAdminOrDoctor } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { db } = require('../config/db');

// Public
router.get('/', doctorController.getAllDoctors);
router.get('/by-service/:serviceId', doctorController.getDoctorsByService);

// Doctor own profile
router.get('/me', authenticateToken, requireAdminOrDoctor, doctorController.getMyProfile);

// Single doctor
router.get('/:id', doctorController.getDoctorById);

// Admin only
router.post('/', authenticateToken, requireAdmin, doctorController.createDoctor);
router.delete('/:id', authenticateToken, requireAdmin, doctorController.deleteDoctor);

// Admin or Doctor
router.put('/:id', authenticateToken, requireAdminOrDoctor, doctorController.updateDoctor);
router.put('/:id/services', authenticateToken, requireAdminOrDoctor, doctorController.updateDoctorServices);
router.put('/:id/schedule', authenticateToken, requireAdminOrDoctor, doctorController.updateSchedule);

// Photo upload
router.post('/:id/photo', authenticateToken, requireAdminOrDoctor, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const photoUrl = `/uploads/doctors/${req.file.filename}`;
    await db.query('UPDATE doctors SET photo_url = ? WHERE id = ?', [photoUrl, req.params.id]);

    res.json({ message: 'Photo uploaded successfully', photo_url: photoUrl });
  } catch (error) { next(error); }
});

module.exports = router;
