const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

router.get('/', settingsController.getAllSettings);
router.put('/:key', settingsController.updateSetting); // protect with admin auth in Week 2

module.exports = router;
