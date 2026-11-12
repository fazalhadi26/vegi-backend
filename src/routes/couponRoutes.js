const express = require('express');
const router = express.Router();
const {
  getCoupons,
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../controllers/couponController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');

// Public/Customer can validate a coupon
router.post('/validate', validateCoupon);

// Admin endpoints
router.get('/', protect, authorizeRoles('admin'), getCoupons);
router.post('/', protect, authorizeRoles('admin'), createCoupon);
router.put('/:id', protect, authorizeRoles('admin'), updateCoupon);
router.delete('/:id', protect, authorizeRoles('admin'), deleteCoupon);

module.exports = router;

