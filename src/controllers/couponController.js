const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const Coupon = require('../models/Coupon');

// @desc    Get all coupons (Admin)
// @route   GET /api/coupons
// @access  Private (Admin)
const getCoupons = async (req, res, next) => {
  try {
    if (getMongoStatus()) {
      const coupons = await Coupon.find().sort({ createdAt: -1 });
      return res.status(200).json({ success: true, count: coupons.length, data: coupons });
    } else {
      return res.status(200).json({ success: true, count: store.coupons.length, data: store.coupons });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Validate coupon and calculate discount
// @route   POST /api/coupons/validate
// @access  Public / Customer
const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    }

    const cleanCode = code.toUpperCase().trim();
    const sub = Number(subtotal) || 0;

    let coupon;
    if (getMongoStatus()) {
      coupon = await Coupon.findOne({ code: cleanCode });
    } else {
      coupon = store.coupons.find((c) => c.code.toUpperCase() === cleanCode);
    }

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid promo code. Please check and try again.' });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ success: false, message: 'This promo code is no longer active.' });
    }

    if (new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ success: false, message: 'This coupon has expired.' });
    }

    if (sub < coupon.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `This coupon requires a minimum vegetable order of ${coupon.minimumOrderAmount.toFixed(2)} QAR.`,
      });
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = Number(((sub * coupon.discountValue) / 100).toFixed(2));
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      discount = Math.min(coupon.discountValue, sub);
    }

    return res.status(200).json({
      success: true,
      message: `Coupon '${coupon.code}' applied! You saved ${discount.toFixed(2)} QAR.`,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
        subtotal: sub,
        newTotal: Number((sub - discount).toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new coupon (Admin)
// @route   POST /api/coupons
// @access  Private (Admin)
const createCoupon = async (req, res, next) => {
  try {
    const { code, description, discountType, discountValue, minimumOrderAmount, maxDiscountAmount, expiryDate, usageLimit } = req.body;

    if (!code || !discountValue || !expiryDate) {
      return res.status(400).json({ success: false, message: 'Code, discount value, and expiry date are required.' });
    }

    const cleanCode = code.toUpperCase().trim();

    if (getMongoStatus()) {
      const exists = await Coupon.findOne({ code: cleanCode });
      if (exists) return res.status(400).json({ success: false, message: 'Coupon code already exists.' });

      const coupon = await Coupon.create({
        code: cleanCode,
        description: description || '',
        discountType: discountType || 'percentage',
        discountValue: Number(discountValue),
        minimumOrderAmount: Number(minimumOrderAmount) || 0,
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        expiryDate: new Date(expiryDate),
        usageLimit: Number(usageLimit) || 100,
        isActive: true,
      });

      return res.status(201).json({ success: true, message: 'Coupon created successfully.', data: coupon });
    } else {
      const exists = store.coupons.find((c) => c.code.toUpperCase() === cleanCode);
      if (exists) return res.status(400).json({ success: false, message: 'Coupon code already exists.' });

      const newCoupon = {
        _id: store.generateId(),
        code: cleanCode,
        description: description || '',
        discountType: discountType || 'percentage',
        discountValue: Number(discountValue),
        minimumOrderAmount: Number(minimumOrderAmount) || 0,
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        expiryDate: new Date(expiryDate),
        usageLimit: Number(usageLimit) || 100,
        usedCount: 0,
        isActive: true,
        createdAt: new Date(),
      };

      store.coupons.push(newCoupon);
      return res.status(201).json({ success: true, message: 'Coupon created successfully.', data: newCoupon });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update coupon (Admin)
// @route   PUT /api/coupons/:id
// @access  Private (Admin)
const updateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (getMongoStatus()) {
      const coupon = await Coupon.findByIdAndUpdate(id, req.body, { new: true });
      if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found.' });
      return res.status(200).json({ success: true, message: 'Coupon updated.', data: coupon });
    } else {
      const idx = store.coupons.findIndex((c) => c._id === id || c.code === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Coupon not found.' });
      store.coupons[idx] = { ...store.coupons[idx], ...req.body };
      return res.status(200).json({ success: true, message: 'Coupon updated.', data: store.coupons[idx] });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete coupon (Admin)
// @route   DELETE /api/coupons/:id
// @access  Private (Admin)
const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (getMongoStatus()) {
      await Coupon.findByIdAndDelete(id);
      return res.status(200).json({ success: true, message: 'Coupon deleted successfully.' });
    } else {
      store.coupons = store.coupons.filter((c) => c._id !== id && c.code !== id);
      return res.status(200).json({ success: true, message: 'Coupon deleted successfully.' });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCoupons,
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};

