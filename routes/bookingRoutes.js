const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticateToken, requireAdmin, optionalAuth, requireAdminOrDoctor } = require('../middleware/auth');

router.post('/', optionalAuth, bookingController.createBooking);
router.get('/my', authenticateToken, bookingController.getMyBookings);
router.get('/doctor', authenticateToken, bookingController.getDoctorBookings);
router.get('/', authenticateToken, requireAdmin, bookingController.getAllBookings);
router.get('/:id', authenticateToken, bookingController.getBookingById);
router.put('/:id', authenticateToken, bookingController.updateBooking);
router.delete('/:id', authenticateToken, requireAdmin, bookingController.deleteBooking);
router.post('/:id/approve-reassign', authenticateToken, bookingController.approveReassign);
router.post('/:id/decline-reassign', authenticateToken, bookingController.declineReassign);

module.exports = router;
