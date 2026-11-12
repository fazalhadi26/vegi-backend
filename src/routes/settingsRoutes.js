const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');

router.get('/', getSettings);
router.put('/admin/settings', protect, authorizeRoles('admin'), updateSettings);

module.exports = router;

