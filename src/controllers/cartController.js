const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Helper to populate item details and calculate cart totals
const buildCartResponse = (cartItems, allProducts) => {
  let subtotal = 0;
  const items = [];

  for (const item of cartItems) {
    const prod = allProducts.find((p) => p._id.toString() === item.productId.toString());
    if (prod && !prod.isArchived) {
      const price = prod.discountPrice || prod.sellingPrice;
      const itemTotal = Number((price * item.quantity).toFixed(2));
      subtotal += itemTotal;

      items.push({
        _id: item._id || item.productId,
        productId: prod._id,
        name: prod.name,
        sku: prod.sku,
        unit: prod.unit,
        price,
        originalPrice: prod.sellingPrice,
        image: prod.images && prod.images.length > 0 ? prod.images[0] : '',
        stockQuantity: prod.stockQuantity,
        isAvailable: prod.isAvailable && prod.stockQuantity > 0,
        quantity: item.quantity,
        total: itemTotal,
      });
    }
  }

  const standardDeliveryFee = 10;
  const freeThreshold = 100;
  const deliveryFee = subtotal >= freeThreshold || subtotal === 0 ? 0 : standardDeliveryFee;
  const totalAmount = Number((subtotal + deliveryFee).toFixed(2));

  return {
    items,
    itemCount: items.reduce((acc, it) => acc + it.quantity, 0),
    subtotal: Number(subtotal.toFixed(2)),
    deliveryFee,
    freeDeliveryThreshold: freeThreshold,
    amountNeededForFreeDelivery: subtotal >= freeThreshold ? 0 : Number((freeThreshold - subtotal).toFixed(2)),
    totalAmount,
    currency: 'QAR',
  };
};

// @desc    Get customer cart
// @route   GET /api/cart
// @access  Private (Customer)
const getCart = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;

    if (getMongoStatus()) {
      let cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart) {
        cart = await Cart.create({ userId, items: [] });
      }
      const allProducts = await Product.find({ _id: { $in: cart.items.map((i) => i.productId) } });
      const formatted = buildCartResponse(cart.items, allProducts);
      return res.status(200).json({ success: true, data: formatted });
    } else {
      const cartItems = store.carts[userId.toString()] || [];
      const formatted = buildCartResponse(cartItems, store.products);
      return res.status(200).json({ success: true, data: formatted });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private (Customer)
const addToCart = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    if (getMongoStatus()) {
      const product = await Product.findById(productId);
      if (!product || product.isArchived) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      if (!product.isAvailable || product.stockQuantity < 1) {
        return res.status(400).json({ success: false, message: 'Product is currently out of stock.' });
      }

      let cart = await Cart.findOne({ userId });
      if (!cart) {
        cart = await Cart.create({ userId, items: [] });
      }

      const existingItem = cart.items.find((item) => item.productId.toString() === productId.toString());
      if (existingItem) {
        existingItem.quantity += Number(quantity);
      } else {
        cart.items.push({ productId, quantity: Number(quantity) });
      }

      await cart.save();
      const allProducts = await Product.find({ _id: { $in: cart.items.map((i) => i.productId) } });
      const formatted = buildCartResponse(cart.items, allProducts);

      return res.status(200).json({
        success: true,
        message: `${product.name} added to cart.`,
        data: formatted,
      });
    } else {
      const product = store.products.find((p) => p._id.toString() === productId.toString());
      if (!product || product.isArchived) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      if (!product.isAvailable || product.stockQuantity < 1) {
        return res.status(400).json({ success: false, message: 'Product is currently out of stock.' });
      }

      const uIdStr = userId.toString();
      if (!store.carts[uIdStr]) {
        store.carts[uIdStr] = [];
      }

      const existingItem = store.carts[uIdStr].find((i) => i.productId.toString() === productId.toString());
      if (existingItem) {
        existingItem.quantity += Number(quantity);
      } else {
        store.carts[uIdStr].push({
          _id: store.generateId(),
          productId,
          quantity: Number(quantity),
        });
      }

      const formatted = buildCartResponse(store.carts[uIdStr], store.products);
      return res.status(200).json({
        success: true,
        message: `${product.name} added to cart.`,
        data: formatted,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:id
// @access  Private (Customer)
const updateCartItemQuantity = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params; // itemId or productId
    const { quantity } = req.body;

    if (quantity === undefined || Number(quantity) < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1. To remove, use delete.' });
    }

    if (getMongoStatus()) {
      const cart = await Cart.findOne({ userId });
      if (!cart) return res.status(404).json({ success: false, message: 'Cart is empty.' });

      const item = cart.items.find(
        (i) => i._id.toString() === id.toString() || i.productId.toString() === id.toString()
      );
      if (!item) return res.status(404).json({ success: false, message: 'Item not in cart.' });

      item.quantity = Number(quantity);
      await cart.save();

      const allProducts = await Product.find({ _id: { $in: cart.items.map((i) => i.productId) } });
      const formatted = buildCartResponse(cart.items, allProducts);
      return res.status(200).json({ success: true, data: formatted });
    } else {
      const uIdStr = userId.toString();
      const cartItems = store.carts[uIdStr] || [];
      const item = cartItems.find(
        (i) => i._id.toString() === id.toString() || i.productId.toString() === id.toString()
      );
      if (!item) return res.status(404).json({ success: false, message: 'Item not in cart.' });

      item.quantity = Number(quantity);
      const formatted = buildCartResponse(cartItems, store.products);
      return res.status(200).json({ success: true, data: formatted });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:id
// @access  Private (Customer)
const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;

    if (getMongoStatus()) {
      const cart = await Cart.findOne({ userId });
      if (cart) {
        cart.items = cart.items.filter(
          (i) => i._id.toString() !== id.toString() && i.productId.toString() !== id.toString()
        );
        await cart.save();
        const allProducts = await Product.find({ _id: { $in: cart.items.map((i) => i.productId) } });
        const formatted = buildCartResponse(cart.items, allProducts);
        return res.status(200).json({ success: true, message: 'Item removed from cart.', data: formatted });
      }
      return res.status(200).json({ success: true, data: { items: [], totalAmount: 0 } });
    } else {
      const uIdStr = userId.toString();
      if (store.carts[uIdStr]) {
        store.carts[uIdStr] = store.carts[uIdStr].filter(
          (i) => i._id.toString() !== id.toString() && i.productId.toString() !== id.toString()
        );
      }
      const formatted = buildCartResponse(store.carts[uIdStr] || [], store.products);
      return res.status(200).json({ success: true, message: 'Item removed from cart.', data: formatted });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/cart
// @access  Private (Customer)
const clearCart = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;

    if (getMongoStatus()) {
      await Cart.findOneAndUpdate({ userId }, { items: [] });
    } else {
      store.carts[userId.toString()] = [];
    }

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully.',
      data: { items: [], itemCount: 0, subtotal: 0, deliveryFee: 0, totalAmount: 0, currency: 'QAR' },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
};

