const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const Address = require('../models/Address');

// @desc    List customer addresses
// @route   GET /api/addresses
// @access  Private (Customer)
const getAddresses = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;

    if (getMongoStatus()) {
      const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
      return res.status(200).json({ success: true, count: addresses.length, data: addresses });
    } else {
      const addresses = store.addresses.filter((a) => a.userId.toString() === userId.toString());
      return res.status(200).json({ success: true, count: addresses.length, data: addresses });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Add new delivery address (Qatar format)
// @route   POST /api/addresses
// @access  Private (Customer)
const addAddress = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { fullName, phoneNumber, zone, street, building, apartment, instructions, isDefault } = req.body;

    if (!zone || !street || !building) {
      return res.status(400).json({
        success: false,
        message: 'Qatar delivery address requires Zone, Street, and Building numbers.',
      });
    }

    if (getMongoStatus()) {
      if (isDefault) {
        await Address.updateMany({ userId }, { isDefault: false });
      }

      const address = await Address.create({
        userId,
        fullName: fullName || req.user.fullName,
        phoneNumber: phoneNumber || req.user.phoneNumber,
        zone,
        street,
        building,
        apartment: apartment || '',
        instructions: instructions || '',
        isDefault: Boolean(isDefault),
      });

      return res.status(201).json({ success: true, message: 'Address saved successfully.', data: address });
    } else {
      if (isDefault) {
        store.addresses.forEach((a) => {
          if (a.userId.toString() === userId.toString()) a.isDefault = false;
        });
      }

      const newAddress = {
        _id: store.generateId(),
        userId,
        fullName: fullName || req.user.fullName,
        phoneNumber: phoneNumber || req.user.phoneNumber,
        zone,
        street,
        building,
        apartment: apartment || '',
        instructions: instructions || '',
        isDefault: Boolean(isDefault),
        createdAt: new Date(),
      };

      store.addresses.push(newAddress);
      return res.status(201).json({ success: true, message: 'Address saved successfully.', data: newAddress });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update delivery address
// @route   PUT /api/addresses/:id
// @access  Private (Customer)
const updateAddress = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;

    if (getMongoStatus()) {
      if (req.body.isDefault) {
        await Address.updateMany({ userId }, { isDefault: false });
      }
      const address = await Address.findOneAndUpdate({ _id: id, userId }, req.body, { new: true });
      if (!address) return res.status(404).json({ success: false, message: 'Address not found.' });
      return res.status(200).json({ success: true, message: 'Address updated.', data: address });
    } else {
      const addr = store.addresses.find((a) => a._id === id && a.userId.toString() === userId.toString());
      if (!addr) return res.status(404).json({ success: false, message: 'Address not found.' });

      if (req.body.isDefault) {
        store.addresses.forEach((a) => {
          if (a.userId.toString() === userId.toString()) a.isDefault = false;
        });
      }

      Object.assign(addr, req.body);
      return res.status(200).json({ success: true, message: 'Address updated.', data: addr });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete delivery address
// @route   DELETE /api/addresses/:id
// @access  Private (Customer)
const deleteAddress = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;

    if (getMongoStatus()) {
      const result = await Address.findOneAndDelete({ _id: id, userId });
      if (!result) return res.status(404).json({ success: false, message: 'Address not found.' });
      return res.status(200).json({ success: true, message: 'Address deleted successfully.' });
    } else {
      const idx = store.addresses.findIndex((a) => a._id === id && a.userId.toString() === userId.toString());
      if (idx === -1) return res.status(404).json({ success: false, message: 'Address not found.' });
      store.addresses.splice(idx, 1);
      return res.status(200).json({ success: true, message: 'Address deleted successfully.' });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
};

