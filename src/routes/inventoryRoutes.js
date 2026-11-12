const express = require('express');
const router = express.Router();
const {
  getInventoryMovements,
  recordMovement,
  getLowStockAlerts,
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');

router.use(protect, authorizeRoles('admin'));

router.get('/movements', getInventoryMovements);
router.post('/movement', recordMovement);
router.get('/low-stock', getLowStockAlerts);

module.exports = router;

