const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/',    serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);

router.post('/',      authenticateToken, requireAdmin, serviceController.createService);
router.put('/:id',   authenticateToken, requireAdmin, serviceController.updateService);
router.delete('/:id', authenticateToken, requireAdmin, serviceController.deleteService);

module.exports = router;