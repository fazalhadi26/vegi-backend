const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    zoneNumber: { type: String, default: '' },
    deliveryFee: { type: Number, default: 10 },
    minOrder: { type: Number, default: 30 },
    estimatedDeliveryTime: { type: String, default: '45-90 mins' },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const settingsSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      default: 'Qatar Fresh Veg',
    },
    storeTagline: {
      type: String,
      default: 'Farm Fresh Vegetables Delivered Across Qatar',
    },
    logo: {
      type: String,
      default: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&q=80',
    },
    contactPhone: {
      type: String,
      default: '+974 4455 6677',
    },
    contactEmail: {
      type: String,
      default: 'support@qatarfreshveg.qa',
    },
    contactAddress: {
      type: String,
      default: 'Wholesale Market Street, Abu Hamour, Doha, Qatar',
    },
    currency: {
      type: String,
      default: 'QAR',
    },
    currencySymbol: {
      type: String,
      default: 'QR',
    },
    standardDeliveryFee: {
      type: Number,
      default: 10,
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 100,
    },
    minimumOrderAmount: {
      type: Number,
      default: 30,
    },
    openingHours: {
      type: String,
      default: 'Daily 06:00 AM - 11:00 PM (Fresh Pick & Deliver)',
    },
    deliveryZones: [deliveryZoneSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Settings', settingsSchema);

