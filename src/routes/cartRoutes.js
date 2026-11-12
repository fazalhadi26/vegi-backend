const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

router.use(protect); // Customer auth required

router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:id', updateCartItemQuantity);
router.delete('/items/:id', removeFromCart);
router.delete('/', clearCart);

module.exports = router;

