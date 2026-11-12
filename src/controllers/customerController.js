const bcrypt = require('bcryptjs');
const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const User = require('../models/User');
const Order = require('../models/Order');

// Validation helpers
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const isValidPhone = (phone) => {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8;
};

const ALLOWED_ROLES = ['customer', 'admin', 'delivery'];

// @desc    List all users with metrics and optional role filtering (Admin)
// @route   GET /api/admin/customers or /api/admin/users
// @access  Private (Admin)
const getCustomers = async (req, res, next) => {
  try {
    const { search, role } = req.query;

    if (getMongoStatus()) {
      let query = {};

      // Filter by role if specified and not 'all'
      if (role && role !== 'all') {
        query.role = role.toLowerCase();
      }

      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
        ];
      }

      const users = await User.find(query).select('-passwordHash').sort({ createdAt: -1 });

      // Attach customer & user metrics (orders count, total spent)
      const usersWithMetrics = await Promise.all(
        users.map(async (u) => {
          const orders = await Order.find({ userId: u._id, orderStatus: { $ne: 'Cancelled' } });
          const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          return {
            ...u.toObject(),
            ordersCount: orders.length,
            totalSpent: Number(totalSpent.toFixed(2)),
          };
        })
      );

      return res.status(200).json({
        success: true,
        count: usersWithMetrics.length,
        data: usersWithMetrics,
      });
    } else {
      // In-Memory Fallback
      let users = [...store.users];

      if (role && role !== 'all') {
        users = users.filter((u) => u.role === role.toLowerCase());
      }

      if (search) {
        const s = search.toLowerCase();
        users = users.filter(
          (u) =>
            (u.fullName && u.fullName.toLowerCase().includes(s)) ||
            (u.email && u.email.toLowerCase().includes(s)) ||
            (u.phoneNumber && u.phoneNumber.includes(s))
        );
      }

      const usersWithMetrics = users.map((u) => {
        const orders = store.orders.filter(
          (o) => o.userId && o.userId.toString() === u._id.toString() && o.orderStatus !== 'Cancelled'
        );
        const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const { passwordHash, ...userClean } = u;
        return {
          ...userClean,
          ordersCount: orders.length,
          totalSpent: Number(totalSpent.toFixed(2)),
        };
      });

      return res.status(200).json({
        success: true,
        count: usersWithMetrics.length,
        data: usersWithMetrics,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Creates a New User with ANY Role (customer, admin, delivery)
// @route   POST /api/admin/customers or /api/admin/users
// @access  Private (Admin)
const createUser = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, password, role = 'customer' } = req.body;

    if (!fullName || !email || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, phone number, and initial password.',
      });
    }

    const trimmedName = String(fullName).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(phoneNumber).trim();
    const cleanPass = String(password).trim();
    const targetRole = String(role).trim().toLowerCase();

    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be at least 2 characters long.',
      });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (at least 8 digits).',
      });
    }

    if (cleanPass.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (!ALLOWED_ROLES.includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role "${role}". Allowed roles: customer, admin, delivery.`,
      });
    }

    if (getMongoStatus()) {
      const emailExists = await User.findOne({ email: cleanEmail });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists.',
        });
      }

      const phoneExists = await User.findOne({ phoneNumber: cleanPhone });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: 'An account with this phone number already exists.',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(cleanPass, salt);

      const user = await User.create({
        fullName: trimmedName,
        email: cleanEmail,
        phoneNumber: cleanPhone,
        passwordHash,
        role: targetRole,
        isActive: true,
      });

      const userObj = user.toObject();
      delete userObj.passwordHash;

      return res.status(201).json({
        success: true,
        message: `User created successfully with role "${targetRole}".`,
        data: {
          ...userObj,
          ordersCount: 0,
          totalSpent: 0,
        },
      });
    } else {
      const emailExists = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists.',
        });
      }

      const phoneExists = store.users.find((u) => u.phoneNumber === cleanPhone);
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: 'An account with this phone number already exists.',
        });
      }

      const newUser = {
        _id: store.generateId(),
        fullName: trimmedName,
        email: cleanEmail,
        phoneNumber: cleanPhone,
        passwordHash: bcrypt.hashSync(cleanPass, 10),
        role: targetRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.users.push(newUser);
      const { passwordHash, ...userClean } = newUser;

      return res.status(201).json({
        success: true,
        message: `User created successfully with role "${targetRole}".`,
        data: {
          ...userClean,
          ordersCount: 0,
          totalSpent: 0,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Changes User Role (customer <-> admin <-> delivery)
// @route   PATCH /api/admin/customers/:id/role
// @access  Private (Admin)
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Please specify the new role for this user.',
      });
    }

    const cleanRole = String(role).trim().toLowerCase();
    if (!ALLOWED_ROLES.includes(cleanRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role "${role}". Allowed roles: customer, admin, delivery.`,
      });
    }

    if (getMongoStatus()) {
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      user.role = cleanRole;
      await user.save();

      const userObj = user.toObject();
      delete userObj.passwordHash;

      return res.status(200).json({
        success: true,
        message: `User ${user.fullName} role has been updated to "${cleanRole}".`,
        data: userObj,
      });
    } else {
      const user = store.users.find((u) => u._id === id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      user.role = cleanRole;
      user.updatedAt = new Date();
      const { passwordHash, ...userClean } = user;

      return res.status(200).json({
        success: true,
        message: `User ${user.fullName} role has been updated to "${cleanRole}".`,
        data: userClean,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Customer / User Active/Suspended status (Admin)
// @route   PATCH /api/admin/customers/:id/status
// @access  Private (Admin)
const toggleCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (getMongoStatus()) {
      const user = await User.findByIdAndUpdate(
        id,
        { isActive: Boolean(isActive) },
        { new: true }
      ).select('-passwordHash');

      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      return res.status(200).json({
        success: true,
        message: `Account for ${user.fullName} is now ${isActive ? 'Active' : 'Suspended'}.`,
        data: user,
      });
    } else {
      const user = store.users.find((u) => u._id === id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      user.isActive = Boolean(isActive);
      user.updatedAt = new Date();
      const { passwordHash, ...userClean } = user;

      return res.status(200).json({
        success: true,
        message: `Account for ${user.fullName} is now ${isActive ? 'Active' : 'Suspended'}.`,
        data: userClean,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account (Admin)
// @route   DELETE /api/admin/customers/:id
// @access  Private (Admin)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (getMongoStatus()) {
      const user = await User.findByIdAndDelete(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      return res.status(200).json({
        success: true,
        message: `User account for ${user.fullName} has been deleted.`,
      });
    } else {
      const index = store.users.findIndex((u) => u._id === id);
      if (index === -1) return res.status(404).json({ success: false, message: 'User not found.' });
      const [removed] = store.users.splice(index, 1);
      return res.status(200).json({
        success: true,
        message: `User account for ${removed.fullName} has been deleted.`,
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  createUser,
  updateUserRole,
  toggleCustomerStatus,
  deleteUser,
};
