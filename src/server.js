require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const startServer = async () => {
  // Attempt DB Connection
  await connectDB();

  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🥒 Qatar Fresh Veg - Backend REST API Service`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌍 Target Market: Qatar (Currency: QAR, Code: +974)`);
    console.log(`📋 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🛒 Products API: http://localhost:${PORT}/api/products`);
    console.log(`📊 Admin Credentials: admin@qatarfreshveg.qa / Admin@123456`);
    console.log(`👤 Customer Demo: hamad@qatarfreshveg.qa / Customer@123456`);
    console.log(`====================================================`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start Qatar Fresh Veg server:', err);
  process.exit(1);
});

