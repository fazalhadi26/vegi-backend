const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    images: {
      type: [String],
      default: [],
    },
    buyingPrice: {
      type: Number,
      required: true,
      min: 0,
      comment: 'Price in QAR',
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
      comment: 'Price in QAR',
    },
    discountPrice: {
      type: Number,
      default: null,
    },
    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', '500g', '250g', 'piece', 'bunch', 'box', 'tray'],
      default: 'kg',
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    origin: {
      type: String,
      default: 'Qatar (Local Farm)',
    },
    nutritionalInfo: {
      calories: { type: String, default: '' },
      vitamins: { type: String, default: '' },
      storage: { type: String, default: 'Keep refrigerated between 2-5°C' },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isSeasonal: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ name: 'text', description: 'text', sku: 'text' });

module.exports = mongoose.model('Product', productSchema);

