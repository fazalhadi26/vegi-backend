const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  getFeaturedProducts,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');

router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/search', searchProducts);
router.get('/:id', getProductById);

// Admin-only endpoints
router.post('/', protect, authorizeRoles('admin'), createProduct);
router.put('/:id', protect, authorizeRoles('admin'), updateProduct);
router.delete('/:id', protect, authorizeRoles('admin'), deleteProduct);

module.exports = router;

