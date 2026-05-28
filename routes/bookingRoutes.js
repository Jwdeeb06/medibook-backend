const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const adminBookingController = require('../controllers/adminBookingController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');

// Public / guest
router.post('/', optionalAuth, bookingController.createBooking);

// Admin creates booking directly
router.post('/admin-create', authenticateToken, requireAdmin, adminBookingController.adminCreateBooking);

// Patient routes
router.get('/my', authenticateToken, bookingController.getMyBookings);
router.get('/doctor', authenticateToken, bookingController.getDoctorBookings);

// Admin routes
router.get('/', authenticateToken, requireAdmin, bookingController.getAllBookings);
router.get('/:id', authenticateToken, bookingController.getBookingById);
router.put('/:id', authenticateToken, bookingController.updateBooking);
router.delete('/:id', authenticateToken, requireAdmin, bookingController.deleteBooking);

// Reassign approval
router.post('/:id/approve-reassign', authenticateToken, bookingController.approveReassign);
router.post('/:id/decline-reassign', authenticateToken, bookingController.declineReassign);

// Patient reschedule request
router.post('/:id/request-reschedule', authenticateToken, bookingController.requestReschedule);

module.exports = router;
