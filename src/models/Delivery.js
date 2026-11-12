const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    deliveryPersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deliveryPersonName: {
      type: String,
      default: '',
    },
    deliveryPersonPhone: {
      type: String,
      default: '',
    },
    deliveryStatus: {
      type: String,
      enum: ['Assigned', 'Picked Up', 'On The Way', 'Delivered', 'Failed'],
      default: 'Assigned',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    pickedUpAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    vehicleNotes: {
      type: String,
      default: 'Refrigerated Fresh Delivery Van #4',
    },
    deliveryNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Delivery', deliverySchema);

