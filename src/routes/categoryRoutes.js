const express = require('express');
const router = express.Router();
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');

router.get('/', getCategories);
router.post('/', protect, authorizeRoles('admin'), createCategory);
router.put('/:id', protect, authorizeRoles('admin'), updateCategory);
router.delete('/:id', protect, authorizeRoles('admin'), deleteCategory);

module.exports = router;

