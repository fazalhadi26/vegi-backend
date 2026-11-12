const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      default: '',
    },
    quantityAdded: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantityRemoved: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentStockAfter: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'Initial Stock',
        'Incoming Supplier Stock',
        'Customer Order Fulfillment',
        'Order Cancelled Restock',
        'Damaged / Spoiled Waste',
        'Manual Inventory Audit Adjustment',
      ],
    },
    batchNumber: {
      type: String,
      default: '',
    },
    supplierName: {
      type: String,
      default: 'Qatar Local Produce Syndicate',
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    recordedBy: {
      type: String,
      default: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);

