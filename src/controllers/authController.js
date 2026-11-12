const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const User = require('../models/User');

const generateToken = (id, role, email, fullName) => {
  return jwt.sign(
    { id, role, email, fullName },
    process.env.JWT_SECRET || 'qatar_fresh_veg_super_secret_jwt_key_2026_qfv',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

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

// @desc    Register a new customer (Default Role: Customer)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;

    // 1. Check required fields
    if (!fullName || !email || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: Full Name, Email, Qatar Phone Number, and Password.',
      });
    }

    const trimmedName = String(fullName).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(phoneNumber).trim();
    const cleanPass = String(password).trim();

    // 2. Validate format
    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full Name must be at least 2 characters long.',
      });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address (e.g., yourname@domain.qa).',
      });
    }

    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Qatar phone number (at least 8 digits, e.g., +974 6611 2233).',
      });
    }

    if (cleanPass.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Default role is strictly 'customer' for public registration (cannot be hijacked)
    const assignedRole = 'customer';

    if (getMongoStatus()) {
      const emailExists = await User.findOne({ email: cleanEmail });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists. Please log in instead.',
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
        role: assignedRole,
        isActive: true,
      });

      const token = generateToken(user._id, user.role, user.email, user.fullName);

      return res.status(201).json({
        success: true,
        message: 'Customer registered successfully. Welcome to Qatar Fresh Veg!',
        data: {
          user: {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isActive: user.isActive,
          },
          token,
        },
      });
    } else {
      // In-Memory Fallback
      const emailExists = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists. Please log in instead.',
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
        role: assignedRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.users.push(newUser);
      const token = generateToken(newUser._id, newUser.role, newUser.email, newUser.fullName);

      return res.status(201).json({
        success: true,
        message: 'Customer registered successfully. Welcome to Qatar Fresh Veg!',
        data: {
          user: {
            _id: newUser._id,
            fullName: newUser.fullName,
            email: newUser.email,
            phoneNumber: newUser.phoneNumber,
            role: newUser.role,
            isActive: newUser.isActive,
          },
          token,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Customer / User login
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both your account identifier (email/phone) and password.',
      });
    }

    const cleanIdentifier = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    let user;
    if (getMongoStatus()) {
      user = await User.findOne({
        $or: [
          { email: cleanIdentifier },
          { phoneNumber: cleanIdentifier },
          { phoneNumber: email.trim() },
        ],
      });
    } else {
      user = store.users.find(
        (u) =>
          u.email.toLowerCase() === cleanIdentifier ||
          u.phoneNumber === cleanIdentifier ||
          u.phoneNumber === email.trim()
      );
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. No account found matching those details.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated or suspended. Please contact support@qatarfreshveg.qa.',
      });
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.',
      });
    }

    const token = generateToken(user._id, user.role, user.email, user.fullName);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isActive: user.isActive,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin / Operations portal login
// @route   POST /api/auth/admin/login
// @access  Public
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide admin email and password.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    let user;
    if (getMongoStatus()) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials. Account not found.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your admin account has been suspended. Please contact operations management.',
      });
    }

    if (user.role !== 'admin' && user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have administrative or fleet dispatch permissions.',
      });
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.',
      });
    }

    const token = generateToken(user._id, user.role, user.email, user.fullName);

    return res.status(200).json({
      success: true,
      message: 'Admin authorization granted.',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isActive: user.isActive,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current authenticated user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password request
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide your account email.' });
    }
    // Return friendly simulated success response with instructions
    return res.status(200).json({
      success: true,
      message: `If an account exists for ${email}, a password reset verification code has been dispatched via SMS / email.`,
      resetToken: 'SIMULATED-RESET-TOKEN-QFV-974',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide email and new password.' });
    }

    const hashed = bcrypt.hashSync(newPassword, 10);
    if (getMongoStatus()) {
      await User.findOneAndUpdate({ email: email.toLowerCase() }, { passwordHash: hashed });
    } else {
      const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        user.passwordHash = hashed;
        user.updatedAt = new Date();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Password has been updated successfully. You can now log in with your new credentials.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout / Invalidate
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res) => {
  res.clearCookie('token');
  return res.status(200).json({
    success: true,
    message: 'User logged out successfully.',
  });
};

module.exports = {
  register,
  login,
  adminLogin,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
  generateToken,
};
