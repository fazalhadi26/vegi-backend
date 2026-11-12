const express = require('express');
const router = express.Router();
const {
  placeOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  assignDeliveryPerson,
} = require('../controllers/orderController');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');

// Customer placing order (Supports authenticated user or guest COD checkout)
router.post('/', optionalAuth, placeOrder);

// Customer endpoints (Protected by JWT)
router.get('/my', protect, getMyOrders);
router.get('/my-orders', protect, getMyOrders);
router.patch('/:id/cancel', protect, cancelOrder);
router.get('/:id', protect, getOrderById);

// Admin & Delivery endpoints
router.get('/', protect, authorizeRoles('admin', 'delivery'), getAllOrders);
router.patch('/:id/status', protect, authorizeRoles('admin'), updateOrderStatus);
router.patch('/:id/assign-delivery', protect, authorizeRoles('admin'), assignDeliveryPerson);

module.exports = router;

