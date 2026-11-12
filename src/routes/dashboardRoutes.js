const express = require('express');
const router = express.Router();
const { getDashboardStats, getSalesReport, getInventoryReport } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');

router.use(protect, authorizeRoles('admin'));

router.get('/dashboard', getDashboardStats);
router.get('/reports/sales', getSalesReport);
router.get('/inventory', getInventoryReport);

module.exports = router;

