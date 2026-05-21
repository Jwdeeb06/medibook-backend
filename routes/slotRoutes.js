const express = require('express');
const router = express.Router();
const slotsController = require('../controllers/slotsController');

// GET /api/slots?doctor_id=1&service_id=2&date=2026-05-20
router.get('/', slotsController.getAvailableSlots);

// GET /api/slots/available-days?doctor_id=1&service_id=2&month=2026-05
router.get('/available-days', slotsController.getAvailableDays);

module.exports = router;
