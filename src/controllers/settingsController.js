const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const Settings = require('../models/Settings');

// @desc    Get store settings and delivery zones
// @route   GET /api/settings
// @access  Public
const getSettings = async (req, res, next) => {
  try {
    if (getMongoStatus()) {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = await Settings.create(store.settings);
      }
      return res.status(200).json({ success: true, data: settings });
    } else {
      return res.status(200).json({ success: true, data: store.settings });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update store settings (Admin)
// @route   PUT /api/admin/settings
// @access  Private (Admin)
const updateSettings = async (req, res, next) => {
  try {
    if (getMongoStatus()) {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = await Settings.create(req.body);
      } else {
        Object.assign(settings, req.body);
        await settings.save();
      }
      return res.status(200).json({ success: true, message: 'Settings updated successfully.', data: settings });
    } else {
      store.settings = { ...store.settings, ...req.body };
      return res.status(200).json({ success: true, message: 'Settings updated successfully.', data: store.settings });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};

