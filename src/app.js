const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const cartRoutes = require('./routes/cartRoutes');
const addressRoutes = require('./routes/addressRoutes');
const orderRoutes = require('./routes/orderRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const couponRoutes = require('./routes/couponRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const customerRoutes = require('./routes/customerRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const { notFound, errorHandler } = require('./middleware/errors');
const { getMongoStatus } = require('./config/db');

const app = express();

// Security HTTP headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS configuration (allow Web Dashboard & Expo Mobile App)
app.use(
  cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});
app.use('/api/', apiLimiter);

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static file uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health & Info Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Qatar Fresh Veg REST API',
    market: 'Qatar',
    currency: 'QAR',
    version: '1.0.0',
    status: 'ONLINE',
    database: getMongoStatus() ? 'MongoDB Connected' : 'In-Memory Resilient Store Active',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes per SRS Specification
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/admin', customerRoutes);
app.use('/api/settings', settingsRoutes);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;

