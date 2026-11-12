const express = require('express');
const router = express.Router();
const {
  getCustomers,
  createUser,
  updateUserRole,
  toggleCustomerStatus,
  deleteUser,
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');

// Restrict all customer/user administration routes to Admin role
router.use(protect, authorizeRoles('admin'));

// Customer / User listing and creation
router.get('/customers', getCustomers);
router.post('/customers', createUser);
router.patch('/customers/:id/status', toggleCustomerStatus);
router.patch('/customers/:id/role', updateUserRole);
router.delete('/customers/:id', deleteUser);

// User aliases for direct clarity
router.get('/users', getCustomers);
router.post('/users', createUser);
router.patch('/users/:id/status', toggleCustomerStatus);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

module.exports = router;
