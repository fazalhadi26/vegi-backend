const crypto = require('crypto');
const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const InventoryMovement = require('../models/InventoryMovement');
const Cart = require('../models/Cart');
const User = require('../models/User');
const { generateToken } = require('./authController');

const generateOrderNumber = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `QFV-${yyyy}${mm}${dd}-${rand}`;
};

// @desc    Place a new customer order
// @route   POST /api/orders
// @access  Public / Customer (Supports authenticated users and guest COD checkout)
const placeOrder = async (req, res, next) => {
  try {
    const {
      items, // array of { productId, quantity }
      addressSnapshot, // { fullName, phoneNumber, zone, street, building, apartment, instructions }
      paymentMethod = 'Cash on Delivery',
      deliverySlot = 'Express Delivery (within 2 hours)',
      couponCode,
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your order must contain at least one vegetable item.' });
    }

    if (!addressSnapshot || !addressSnapshot.zone || !addressSnapshot.street || !addressSnapshot.building) {
      return res.status(400).json({
        success: false,
        message: 'Complete Qatar delivery address (Zone, Street, Building) is required.',
      });
    }

    const customerName = addressSnapshot.fullName || (req.user ? req.user.fullName : 'Valued Customer');
    const customerPhone = addressSnapshot.phoneNumber || (req.user ? req.user.phoneNumber : '+974 6611 2233');

    let userId = req.user ? (req.user._id || req.user.id) : null;
    let guestEmail;
    if (!userId) {
      guestEmail = `guest_${crypto.randomUUID()}@qatarfreshveg.qa`;
      if (getMongoStatus()) {
        const guestUser = await User.create({
          fullName: customerName,
          phoneNumber: customerPhone,
          email: guestEmail,
          passwordHash: 'guest_account_hash',
          role: 'customer',
          isActive: true,
        });
        userId = guestUser._id;
      } else {
        const guestId = store.generateId();
        store.users.push({
          _id: guestId,
          fullName: customerName,
          phoneNumber: customerPhone,
          email: guestEmail,
          role: 'customer',
          isActive: true,
          createdAt: new Date(),
        });
        userId = guestId;
      }
    }

    const orderNumber = generateOrderNumber();
    const verifiedOrderItems = [];
    let subtotal = 0;

    // In-memory or Mongo verification
    if (getMongoStatus()) {
      for (const item of items) {
        const prod = await Product.findById(item.productId);
        if (!prod || prod.isArchived) {
          return res.status(400).json({
            success: false,
            message: `Product with ID ${item.productId} is no longer available in our catalogue.`,
          });
        }

        if (!prod.isAvailable || prod.stockQuantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for '${prod.name}'. Only ${prod.stockQuantity} ${prod.unit} available.`,
          });
        }

        const price = prod.discountPrice || prod.sellingPrice;
        const lineTotal = Number((price * item.quantity).toFixed(2));
        subtotal += lineTotal;

        verifiedOrderItems.push({
          productId: prod._id,
          name: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          price,
          quantity: Number(item.quantity),
          total: lineTotal,
          image: prod.images && prod.images.length > 0 ? prod.images[0] : '',
        });
      }

      // Check min order amount (15 QAR)
      if (subtotal < 15) {
        return res.status(400).json({
          success: false,
          message: `Minimum order requirement is 15.00 QAR. Your current subtotal is ${subtotal.toFixed(2)} QAR.`,
        });
      }

      // Check coupon
      let discount = 0;
      let appliedCoupon = null;
      if (couponCode) {
        const coupon = await Coupon.findOne({
          code: couponCode.toUpperCase().trim(),
          isActive: true,
          expiryDate: { $gt: new Date() },
        });

        if (coupon && subtotal >= coupon.minimumOrderAmount) {
          if (coupon.discountType === 'percentage') {
            discount = Number(((subtotal * coupon.discountValue) / 100).toFixed(2));
            if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
              discount = coupon.maxDiscountAmount;
            }
          } else {
            discount = coupon.discountValue;
          }
          appliedCoupon = coupon.code;
          coupon.usedCount += 1;
          await coupon.save();
        }
      }

      const standardDeliveryFee = 10;
      const deliveryFee = subtotal >= 100 ? 0 : standardDeliveryFee;
      const totalAmount = Number((subtotal - discount + deliveryFee).toFixed(2));

      // Atomic stock deduction & movement logs
      for (const it of verifiedOrderItems) {
        const updated = await Product.findByIdAndUpdate(
          it.productId,
          { $inc: { stockQuantity: -it.quantity } },
          { new: true }
        );

        if (updated.stockQuantity <= 0) {
          await Product.findByIdAndUpdate(it.productId, { isAvailable: false });
        }

        await InventoryMovement.create({
          productId: it.productId,
          productName: it.name,
          quantityAdded: 0,
          quantityRemoved: it.quantity,
          currentStockAfter: updated.stockQuantity,
          reason: 'Customer Order Fulfillment',
          batchNumber: `ORDER-${orderNumber}`,
          recordedBy: 'Order Engine',
        });
      }

      const order = await Order.create({
        orderNumber,
        userId,
        items: verifiedOrderItems,
        subtotal: Number(subtotal.toFixed(2)),
        deliveryFee,
        discount,
        couponCode: appliedCoupon,
        totalAmount,
        currency: 'QAR',
        addressSnapshot: {
          fullName: customerName,
          phoneNumber: customerPhone,
          zone: addressSnapshot.zone,
          street: addressSnapshot.street,
          building: addressSnapshot.building,
          apartment: addressSnapshot.apartment || '',
          instructions: addressSnapshot.instructions || '',
        },
        paymentMethod: paymentMethod || 'Cash on Delivery',
        paymentStatus: paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Paid',
        orderStatus: 'Pending',
        deliverySlot,
        statusTimeline: [
          {
            status: 'Pending',
            timestamp: new Date(),
            note: `Order placed via mobile application (${paymentMethod || 'Cash on Delivery'})`,
            updatedBy: customerName,
          },
        ],
        notes: notes || '',
      });

      // Clear customer cart
      await Cart.findOneAndUpdate({ userId }, { items: [] });

      return res.status(201).json({
        success: true,
        message: 'Order placed successfully! Fresh vegetables will be packed shortly.',
        data: order,
        ...(guestEmail && {
          trackingToken: generateToken(userId.toString(), 'customer', guestEmail, customerName),
        }),
      });
    } else {
      // In-Memory Mode
      for (const item of items) {
        const prod = store.products.find((p) => p._id.toString() === item.productId.toString());
        if (!prod || prod.isArchived) {
          return res.status(400).json({
            success: false,
            message: `Product with ID ${item.productId} is no longer available in our catalogue.`,
          });
        }

        if (!prod.isAvailable || prod.stockQuantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for '${prod.name}'. Only ${prod.stockQuantity} ${prod.unit} available.`,
          });
        }

        const price = prod.discountPrice || prod.sellingPrice;
        const lineTotal = Number((price * item.quantity).toFixed(2));
        subtotal += lineTotal;

        verifiedOrderItems.push({
          productId: prod._id,
          name: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          price,
          quantity: Number(item.quantity),
          total: lineTotal,
          image: prod.images && prod.images.length > 0 ? prod.images[0] : '',
        });
      }

      if (subtotal < 15) {
        return res.status(400).json({
          success: false,
          message: `Minimum order requirement is 15.00 QAR. Your current subtotal is ${subtotal.toFixed(2)} QAR.`,
        });
      }

      let discount = 0;
      let appliedCoupon = null;
      if (couponCode) {
        const coupon = store.coupons.find(
          (c) =>
            c.code.toUpperCase() === couponCode.toUpperCase().trim() &&
            c.isActive &&
            new Date(c.expiryDate) > new Date()
        );

        if (coupon && subtotal >= coupon.minimumOrderAmount) {
          if (coupon.discountType === 'percentage') {
            discount = Number(((subtotal * coupon.discountValue) / 100).toFixed(2));
            if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
              discount = coupon.maxDiscountAmount;
            }
          } else {
            discount = coupon.discountValue;
          }
          appliedCoupon = coupon.code;
          coupon.usedCount += 1;
        }
      }

      const standardDeliveryFee = 10;
      const deliveryFee = subtotal >= 100 ? 0 : standardDeliveryFee;
      const totalAmount = Number((subtotal - discount + deliveryFee).toFixed(2));

      // Deduct stock in memory
      for (const it of verifiedOrderItems) {
        const prod = store.products.find((p) => p._id.toString() === it.productId.toString());
        if (prod) {
          prod.stockQuantity -= it.quantity;
          if (prod.stockQuantity <= 0) {
            prod.stockQuantity = 0;
            prod.isAvailable = false;
          }

          store.inventoryMovements.unshift({
            _id: store.generateId(),
            productId: it.productId,
            productName: it.name,
            quantityAdded: 0,
            quantityRemoved: it.quantity,
            currentStockAfter: prod.stockQuantity,
            reason: 'Customer Order Fulfillment',
            batchNumber: `ORDER-${orderNumber}`,
            supplierName: prod.origin || 'Qatar Local Farm',
            recordedBy: 'Order System',
            createdAt: new Date(),
          });
        }
      }

      const newOrder = {
        _id: store.generateId(),
        orderNumber,
        userId: userId.toString(),
        customerName,
        customerPhone,
        items: verifiedOrderItems,
        subtotal: Number(subtotal.toFixed(2)),
        deliveryFee,
        discount,
        couponCode: appliedCoupon,
        totalAmount,
        currency: 'QAR',
        addressSnapshot: {
          fullName: customerName,
          phoneNumber: customerPhone,
          zone: addressSnapshot.zone,
          street: addressSnapshot.street,
          building: addressSnapshot.building,
          apartment: addressSnapshot.apartment || '',
          instructions: addressSnapshot.instructions || '',
        },
        paymentMethod: paymentMethod || 'Cash on Delivery',
        paymentStatus: paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Paid',
        orderStatus: 'Pending',
        deliverySlot,
        statusTimeline: [
          {
            status: 'Pending',
            timestamp: new Date(),
            note: `Order placed via mobile application (${paymentMethod || 'Cash on Delivery'})`,
            updatedBy: customerName,
          },
        ],
        notes: notes || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.orders.unshift(newOrder);

      // Clear cart
      store.carts[userId.toString()] = [];

      return res.status(201).json({
        success: true,
        message: 'Order placed successfully! Fresh vegetables will be packed shortly.',
        data: newOrder,
        ...(guestEmail && {
          trackingToken: generateToken(userId.toString(), 'customer', guestEmail, customerName),
        }),
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer order history
// @route   GET /api/orders/my-orders
// @access  Private (Customer)
const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;

    if (getMongoStatus()) {
      const orders = await Order.find({ userId }).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, count: orders.length, data: orders });
    } else {
      const orders = store.orders
        .filter((o) => o.userId.toString() === userId.toString())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ success: true, count: orders.length, data: orders });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get order details
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    if (getMongoStatus()) {
      const order = await Order.findById(id).populate('userId', 'fullName email phoneNumber');
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      // Check ownership unless admin/delivery
      if (req.user.role === 'customer' && order.userId._id.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this order.' });
      }

      return res.status(200).json({ success: true, data: order });
    } else {
      const order = store.orders.find((o) => o._id === id || o.orderNumber === id);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      if (req.user.role === 'customer' && order.userId.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this order.' });
      }

      return res.status(200).json({ success: true, data: order });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders (Admin / Dispatcher)
// @route   GET /api/orders
// @access  Private (Admin / Delivery)
const getAllOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;

    if (getMongoStatus()) {
      let query = {};
      if (status && status !== 'all') {
        query.orderStatus = status;
      }
      if (search) {
        query.$or = [
          { orderNumber: { $regex: search, $options: 'i' } },
          { 'addressSnapshot.fullName': { $regex: search, $options: 'i' } },
          { 'addressSnapshot.phoneNumber': { $regex: search, $options: 'i' } },
        ];
      }

      const total = await Order.countDocuments(query);
      const orders = await Order.find(query)
        .populate('userId', 'fullName email phoneNumber')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

      return res.status(200).json({
        success: true,
        count: orders.length,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        data: orders,
      });
    } else {
      let result = [...store.orders];
      if (status && status !== 'all') {
        result = result.filter((o) => o.orderStatus === status);
      }
      if (search) {
        const s = search.toLowerCase();
        result = result.filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(s) ||
            (o.addressSnapshot && o.addressSnapshot.fullName.toLowerCase().includes(s)) ||
            (o.addressSnapshot && o.addressSnapshot.phoneNumber.includes(s)) ||
            (o.customerName && o.customerName.toLowerCase().includes(s))
        );
      }

      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const skip = (Number(page) - 1) * Number(limit);
      const paginated = result.slice(skip, skip + Number(limit));

      return res.status(200).json({
        success: true,
        count: paginated.length,
        total: result.length,
        page: Number(page),
        pages: Math.ceil(result.length / Number(limit)),
        data: paginated,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status (Admin)
// @route   PATCH /api/orders/:id/status
// @access  Private (Admin)
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note, paymentStatus, deliveryPersonId, deliveryPersonName, deliveryPersonPhone } = req.body;

    const validStatuses = [
      'Pending',
      'Confirmed',
      'Preparing',
      'Ready for Delivery',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `A valid order status is required. Allowed statuses: ${validStatuses.join(', ')}`,
      });
    }

    if (getMongoStatus()) {
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

      if (status) {
        order.orderStatus = status;
        order.statusTimeline.push({
          status,
          timestamp: new Date(),
          note: note || `Status changed to ${status}`,
          updatedBy: req.user ? req.user.fullName : 'Admin',
        });
      }

      if (paymentStatus) {
        order.paymentStatus = paymentStatus;
      }
      if (deliveryPersonId) {
        order.deliveryPersonId = deliveryPersonId;
        order.deliveryPersonName = deliveryPersonName || order.deliveryPersonName;
        order.deliveryPersonPhone = deliveryPersonPhone || order.deliveryPersonPhone;
      }

      if (status === 'Delivered' && order.paymentMethod === 'Cash on Delivery') {
        order.paymentStatus = 'Paid';
      }

      await order.save();
      return res.status(200).json({
        success: true,
        message: `Order #${order.orderNumber} status updated to ${status}.`,
        data: order,
      });
    } else {
      const order = store.orders.find((o) => o._id === id || o.orderNumber === id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

      if (status) {
        order.orderStatus = status;
        order.statusTimeline.push({
          status,
          timestamp: new Date(),
          note: note || `Status changed to ${status}`,
          updatedBy: req.user ? req.user.fullName : 'Admin',
        });
      }

      if (paymentStatus) {
        order.paymentStatus = paymentStatus;
      }
      if (deliveryPersonId) {
        order.deliveryPersonId = deliveryPersonId;
        order.deliveryPersonName = deliveryPersonName || order.deliveryPersonName;
        order.deliveryPersonPhone = deliveryPersonPhone || order.deliveryPersonPhone;
      }
      if (status === 'Delivered' && order.paymentMethod === 'Cash on Delivery') {
        order.paymentStatus = 'Paid';
      }

      order.updatedAt = new Date();
      return res.status(200).json({
        success: true,
        message: `Order #${order.orderNumber} status updated to ${status}.`,
        data: order,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order (Customer or Admin) with restock restoration
// @route   PATCH /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by customer' } = req.body;
    const userId = req.user._id || req.user.id;

    if (getMongoStatus()) {
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

      if (req.user.role === 'customer' && order.userId.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to cancel this order.' });
      }

      // SRS 7.3: Cancellation policy
      if (order.orderStatus === 'Out for Delivery' || order.orderStatus === 'Delivered') {
        return res.status(400).json({
          success: false,
          message: 'Order is already out for delivery or delivered and cannot be cancelled.',
        });
      }

      if (order.orderStatus === 'Cancelled') {
        return res.status(400).json({ success: false, message: 'Order is already cancelled.' });
      }

      // Restock items
      for (const it of order.items) {
        const prod = await Product.findByIdAndUpdate(
          it.productId,
          { $inc: { stockQuantity: it.quantity }, isAvailable: true },
          { new: true }
        );

        await InventoryMovement.create({
          productId: it.productId,
          productName: it.name,
          quantityAdded: it.quantity,
          quantityRemoved: 0,
          currentStockAfter: prod ? prod.stockQuantity : it.quantity,
          reason: 'Order Cancelled Restock',
          batchNumber: `CANCEL-${order.orderNumber}`,
          recordedBy: req.user.fullName,
        });
      }

      order.orderStatus = 'Cancelled';
      order.cancelReason = reason;
      order.statusTimeline.push({
        status: 'Cancelled',
        timestamp: new Date(),
        note: `Order cancelled. Reason: ${reason}`,
        updatedBy: req.user.fullName,
      });

      await order.save();
      return res.status(200).json({
        success: true,
        message: 'Order cancelled successfully and inventory stock restored.',
        data: order,
      });
    } else {
      const order = store.orders.find((o) => o._id === id || o.orderNumber === id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

      if (req.user.role === 'customer' && order.userId.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to cancel this order.' });
      }

      if (order.orderStatus === 'Out for Delivery' || order.orderStatus === 'Delivered') {
        return res.status(400).json({
          success: false,
          message: 'Order is already out for delivery or delivered and cannot be cancelled.',
        });
      }

      if (order.orderStatus === 'Cancelled') {
        return res.status(400).json({ success: false, message: 'Order is already cancelled.' });
      }

      // Restock items
      for (const it of order.items) {
        const prod = store.products.find((p) => p._id.toString() === it.productId.toString());
        if (prod) {
          prod.stockQuantity += it.quantity;
          prod.isAvailable = true;

          store.inventoryMovements.unshift({
            _id: store.generateId(),
            productId: it.productId,
            productName: it.name,
            quantityAdded: it.quantity,
            quantityRemoved: 0,
            currentStockAfter: prod.stockQuantity,
            reason: 'Order Cancelled Restock',
            batchNumber: `CANCEL-${order.orderNumber}`,
            supplierName: prod.origin || 'Qatar Local Farm',
            recordedBy: req.user.fullName,
            createdAt: new Date(),
          });
        }
      }

      order.orderStatus = 'Cancelled';
      order.cancelReason = reason;
      order.statusTimeline.push({
        status: 'Cancelled',
        timestamp: new Date(),
        note: `Order cancelled. Reason: ${reason}`,
        updatedBy: req.user.fullName,
      });
      order.updatedAt = new Date();

      return res.status(200).json({
        success: true,
        message: 'Order cancelled successfully and inventory stock restored.',
        data: order,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Assign delivery personnel to order (Admin)
// @route   PATCH /api/orders/:id/assign-delivery
// @access  Private (Admin)
const assignDeliveryPerson = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { deliveryPersonId, deliveryPersonName, deliveryPersonPhone } = req.body;

    if (!deliveryPersonId) {
      return res.status(400).json({ success: false, message: 'Delivery person ID is required.' });
    }

    if (getMongoStatus()) {
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

      order.deliveryPersonId = deliveryPersonId;
      order.deliveryPersonName = deliveryPersonName || 'Qatar Express Courier';
      order.deliveryPersonPhone = deliveryPersonPhone || '+974 5599 8877';

      if (order.orderStatus === 'Pending' || order.orderStatus === 'Confirmed') {
        order.orderStatus = 'Ready for Delivery';
      }

      order.statusTimeline.push({
        status: order.orderStatus,
        timestamp: new Date(),
        note: `Assigned to delivery courier: ${order.deliveryPersonName} (${order.deliveryPersonPhone})`,
        updatedBy: req.user.fullName,
      });

      await order.save();
      return res.status(200).json({ success: true, message: 'Delivery courier assigned successfully.', data: order });
    } else {
      const order = store.orders.find((o) => o._id === id || o.orderNumber === id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

      order.deliveryPersonId = deliveryPersonId;
      order.deliveryPersonName = deliveryPersonName || 'Tariq Delivery Lead';
      order.deliveryPersonPhone = deliveryPersonPhone || '+974 5599 8877';

      if (order.orderStatus === 'Pending' || order.orderStatus === 'Confirmed') {
        order.orderStatus = 'Ready for Delivery';
      }

      order.statusTimeline.push({
        status: order.orderStatus,
        timestamp: new Date(),
        note: `Assigned to delivery courier: ${order.deliveryPersonName} (${order.deliveryPersonPhone})`,
        updatedBy: req.user.fullName,
      });

      return res.status(200).json({ success: true, message: 'Delivery courier assigned successfully.', data: order });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  placeOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  assignDeliveryPerson,
};
