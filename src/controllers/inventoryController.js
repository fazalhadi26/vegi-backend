const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');

// @desc    Get inventory movement history
// @route   GET /api/inventory/movements
// @access  Private (Admin)
const getInventoryMovements = async (req, res, next) => {
  try {
    const { productId, reason, page = 1, limit = 50 } = req.query;

    if (getMongoStatus()) {
      let query = {};
      if (productId) query.productId = productId;
      if (reason) query.reason = reason;

      const total = await InventoryMovement.countDocuments(query);
      const movements = await InventoryMovement.find(query)
        .populate('productId', 'name sku unit stockQuantity')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

      return res.status(200).json({
        success: true,
        count: movements.length,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        data: movements,
      });
    } else {
      let result = [...store.inventoryMovements];
      if (productId) result = result.filter((m) => m.productId === productId);
      if (reason) result = result.filter((m) => m.reason === reason);

      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const skip = (Number(page) - 1) * Number(limit);
      const paginated = result.slice(skip, skip + Number(limit));

      return res.status(200).json({
        success: true,
        count: paginated.length,
        total: result.length,
        page: Number(page),
        pages: Math.ceil(result.length / Number(limit)),
        data: paginated,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Record inventory adjustment (Incoming stock, spoilage/damage, manual audit)
// @route   POST /api/inventory/movement
// @access  Private (Admin)
const recordMovement = async (req, res, next) => {
  try {
    const {
      productId,
      type, // 'add' or 'remove'
      quantity,
      reason,
      batchNumber,
      supplierName,
      expiryDate,
      notes,
    } = req.body;

    if (!productId || !type || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, type (add/remove), and valid positive quantity are required.',
      });
    }

    const qty = Number(quantity);
    const quantityAdded = type === 'add' ? qty : 0;
    const quantityRemoved = type === 'remove' ? qty : 0;

    if (getMongoStatus()) {
      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

      let newStock = product.stockQuantity;
      if (type === 'add') {
        newStock += qty;
        product.isAvailable = true;
      } else {
        if (newStock < qty) {
          return res.status(400).json({
            success: false,
            message: `Cannot remove ${qty} units. Current stock is only ${newStock} ${product.unit}.`,
          });
        }
        newStock -= qty;
        if (newStock === 0) {
          product.isAvailable = false;
        }
      }

      product.stockQuantity = newStock;
      await product.save();

      const movement = await InventoryMovement.create({
        productId: product._id,
        productName: product.name,
        quantityAdded,
        quantityRemoved,
        currentStockAfter: newStock,
        reason: reason || (type === 'add' ? 'Incoming Supplier Stock' : 'Damaged / Spoiled Waste'),
        batchNumber: batchNumber || `BATCH-${Date.now()}`,
        supplierName: supplierName || 'Qatar Produce Wholesale',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        recordedBy: req.user ? req.user.fullName : 'Admin',
      });

      return res.status(201).json({
        success: true,
        message: `Inventory updated for ${product.name}. Current stock is now ${newStock} ${product.unit}.`,
        data: { movement, currentStock: newStock },
      });
    } else {
      const product = store.products.find((p) => p._id === productId);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

      let newStock = product.stockQuantity;
      if (type === 'add') {
        newStock += qty;
        product.isAvailable = true;
      } else {
        if (newStock < qty) {
          return res.status(400).json({
            success: false,
            message: `Cannot remove ${qty} units. Current stock is only ${newStock} ${product.unit}.`,
          });
        }
        newStock -= qty;
        if (newStock === 0) {
          product.isAvailable = false;
        }
      }

      product.stockQuantity = newStock;
      product.updatedAt = new Date();

      const newMovement = {
        _id: store.generateId(),
        productId: product._id,
        productName: product.name,
        quantityAdded,
        quantityRemoved,
        currentStockAfter: newStock,
        reason: reason || (type === 'add' ? 'Incoming Supplier Stock' : 'Damaged / Spoiled Waste'),
        batchNumber: batchNumber || `BATCH-${Date.now()}`,
        supplierName: supplierName || 'Qatar Produce Wholesale',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        recordedBy: req.user ? req.user.fullName : 'Admin',
        createdAt: new Date(),
      };

      store.inventoryMovements.unshift(newMovement);

      return res.status(201).json({
        success: true,
        message: `Inventory updated for ${product.name}. Current stock is now ${newStock} ${product.unit}.`,
        data: { movement: newMovement, currentStock: newStock },
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get low stock vegetable alerts
// @route   GET /api/inventory/low-stock
// @access  Private (Admin)
const getLowStockAlerts = async (req, res, next) => {
  try {
    if (getMongoStatus()) {
      const lowStockProducts = await Product.find({
        isArchived: false,
        $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
      }).populate('categoryId', 'name');

      return res.status(200).json({
        success: true,
        count: lowStockProducts.length,
        data: lowStockProducts,
      });
    } else {
      const lowStock = store.products
        .filter((p) => !p.isArchived && p.stockQuantity <= p.lowStockThreshold)
        .map((p) => {
          const cat = store.categories.find((c) => c._id === p.categoryId);
          return {
            ...p,
            categoryId: cat ? { _id: cat._id, name: cat.name } : p.categoryId,
          };
        });

      return res.status(200).json({
        success: true,
        count: lowStock.length,
        data: lowStock,
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventoryMovements,
  recordMovement,
  getLowStockAlerts,
};

