const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    zone: {
      type: String,
      required: true,
      trim: true,
      comment: 'Qatar Zone (e.g. Zone 66 West Bay, Zone 55 Al Waab, Lusail)',
    },
    street: {
      type: String,
      required: true,
      trim: true,
      comment: 'Street Name / Number',
    },
    building: {
      type: String,
      required: true,
      trim: true,
      comment: 'Building / Villa Number',
    },
    apartment: {
      type: String,
      default: '',
      trim: true,
      comment: 'Flat / Unit / Floor',
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
      comment: 'Delivery notes e.g., Ring bell twice, leave at door',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Address', addressSchema);

