const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// @desc    Get Admin Dashboard KPI metrics and chart statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (getMongoStatus()) {
      const totalOrders = await Order.countDocuments();
      const todayOrders = await Order.countDocuments({ createdAt: { $gte: today } });
      const pendingOrders = await Order.countDocuments({ orderStatus: { $in: ['Pending', 'Confirmed', 'Preparing'] } });
      const deliveredOrders = await Order.countDocuments({ orderStatus: 'Delivered' });

      const totalCustomers = await User.countDocuments({ role: 'customer' });
      const activeProducts = await Product.countDocuments({ isArchived: false, isAvailable: true });

      const lowStockProducts = await Product.countDocuments({
        isArchived: false,
        $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
      });

      // Total revenue
      const salesAgg = await Order.aggregate([
        { $match: { orderStatus: { $ne: 'Cancelled' } } },
        { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } },
      ]);
      const totalSales = salesAgg.length > 0 ? Number(salesAgg[0].totalSales.toFixed(2)) : 0;

      // Today's revenue
      const todaySalesAgg = await Order.aggregate([
        { $match: { createdAt: { $gte: today }, orderStatus: { $ne: 'Cancelled' } } },
        { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } },
      ]);
      const todaySales = todaySalesAgg.length > 0 ? Number(todaySalesAgg[0].totalSales.toFixed(2)) : 0;

      // Recent 5 orders
      const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);

      // Low stock list
      const lowStockList = await Product.find({
        isArchived: false,
        $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
      }).limit(6);

      // Sales chart mock data / 7 days
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const chartData = [
        { day: 'Sat', sales: 420, orders: 12 },
        { day: 'Sun', sales: 680, orders: 18 },
        { day: 'Mon', sales: 550, orders: 15 },
        { day: 'Tue', sales: 790, orders: 21 },
        { day: 'Wed', sales: 860, orders: 24 },
        { day: 'Thu', sales: 1120, orders: 32 },
        { day: 'Fri', sales: 1350, orders: 38 },
      ];

      return res.status(200).json({
        success: true,
        data: {
          totalOrders,
          todayOrders,
          pendingOrders,
          deliveredOrders,
          totalCustomers,
          activeProducts,
          lowStockCount: lowStockProducts,
          totalSales,
          todaySales,
          currency: 'QAR',
          recentOrders,
          lowStockList,
          chartData,
        },
      });
    } else {
      // In-Memory Calculation
      const totalOrders = store.orders.length;
      const todayOrders = store.orders.filter((o) => new Date(o.createdAt) >= today).length;
      const pendingOrders = store.orders.filter((o) =>
        ['Pending', 'Confirmed', 'Preparing'].includes(o.orderStatus)
      ).length;
      const deliveredOrders = store.orders.filter((o) => o.orderStatus === 'Delivered').length;

      const totalCustomers = store.users.filter((u) => u.role === 'customer').length;
      const activeProducts = store.products.filter((p) => !p.isArchived && p.isAvailable).length;

      const lowStockList = store.products.filter((p) => !p.isArchived && p.stockQuantity <= p.lowStockThreshold);
      const lowStockCount = lowStockList.length;

      const validOrders = store.orders.filter((o) => o.orderStatus !== 'Cancelled');
      const totalSales = Number(validOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2));

      const todayOrdersList = validOrders.filter((o) => new Date(o.createdAt) >= today);
      const todaySales = Number(todayOrdersList.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2));

      const recentOrders = [...store.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

      const chartData = [
        { day: 'Sat', sales: 420, orders: 12 },
        { day: 'Sun', sales: 680, orders: 18 },
        { day: 'Mon', sales: 550, orders: 15 },
        { day: 'Tue', sales: 790, orders: 21 },
        { day: 'Wed', sales: 860, orders: 24 },
        { day: 'Thu', sales: 1120, orders: 32 },
        { day: 'Fri', sales: 1350, orders: 38 },
      ];

      return res.status(200).json({
        success: true,
        data: {
          totalOrders,
          todayOrders,
          pendingOrders,
          deliveredOrders,
          totalCustomers,
          activeProducts,
          lowStockCount,
          totalSales,
          todaySales,
          currency: 'QAR',
          recentOrders,
          lowStockList: lowStockList.slice(0, 6),
          chartData,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Sales report breakdown
// @route   GET /api/admin/reports/sales
// @access  Private (Admin)
const getSalesReport = async (req, res, next) => {
  try {
    const orders = getMongoStatus()
      ? await Order.find({ orderStatus: { $ne: 'Cancelled' } })
      : store.orders.filter((o) => o.orderStatus !== 'Cancelled');

    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalDeliveryFees = 0;
    const productSalesMap = {};

    for (const ord of orders) {
      totalRevenue += ord.totalAmount || 0;
      totalDiscount += ord.discount || 0;
      totalDeliveryFees += ord.deliveryFee || 0;

      for (const it of ord.items || []) {
        if (!productSalesMap[it.name]) {
          productSalesMap[it.name] = { name: it.name, quantity: 0, revenue: 0, unit: it.unit };
        }
        productSalesMap[it.name].quantity += it.quantity;
        productSalesMap[it.name].revenue += it.total;
      }
    }

    const topSellingProducts = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalDiscount: Number(totalDiscount.toFixed(2)),
        totalDeliveryFees: Number(totalDeliveryFees.toFixed(2)),
        totalOrdersCount: orders.length,
        averageOrderValue: orders.length > 0 ? Number((totalRevenue / orders.length).toFixed(2)) : 0,
        currency: 'QAR',
        topSellingProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Inventory Report for Admin
// @route   GET /api/admin/inventory
// @access  Private (Admin)
const getInventoryReport = async (req, res, next) => {
  try {
    const products = getMongoStatus()
      ? await Product.find({ isArchived: false })
      : store.products.filter((p) => !p.isArchived);

    const movements = getMongoStatus()
      ? await require('../models/InventoryMovement').find().sort({ createdAt: -1 }).limit(20)
      : store.inventoryMovements.slice(-20).reverse();

    const lowStockItems = products.filter(
      (p) => p.stockQuantity <= (p.lowStockThreshold || 10)
    );

    const totalStockQty = products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
    const totalInventoryValue = products.reduce(
      (sum, p) => sum + (p.stockQuantity || 0) * (p.buyingPrice || p.sellingPrice || 0),
      0
    );

    return res.status(200).json({
      success: true,
      data: {
        totalProductsCount: products.length,
        totalStockQty,
        totalInventoryValue: Number(totalInventoryValue.toFixed(2)),
        currency: 'QAR',
        lowStockCount: lowStockItems.length,
        lowStockItems,
        recentMovements: movements,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getSalesReport,
  getInventoryReport,
};

