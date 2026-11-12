require('dotenv').config();
const { connectDB, getMongoStatus } = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Settings = require('../models/Settings');
const {
  defaultAdmin,
  defaultCustomers,
  categories,
  products,
  coupons,
  defaultSettings,
} = require('./seedData');

const runSeed = async () => {
  console.log('🌱 Starting Qatar Fresh Veg Database Seeding...');
  const connected = await connectDB();

  if (!connected) {
    console.log('ℹ️  MongoDB not running locally. In-memory data store is pre-seeded and active by default.');
    process.exit(0);
  }

  try {
    console.log('Clearing old collections...');
    await User.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();
    await Coupon.deleteMany();
    await Settings.deleteMany();

    console.log('Seeding Admin & Customers...');
    await User.create(defaultAdmin);
    await User.insertMany(defaultCustomers);

    console.log('Seeding Categories...');
    await Category.insertMany(categories);

    console.log('Seeding Products...');
    await Product.insertMany(products);

    console.log('Seeding Coupons...');
    await Coupon.insertMany(coupons);

    console.log('Seeding Settings...');
    await Settings.create(defaultSettings);

    console.log('✅ Qatar Fresh Veg Database Seeded Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

runSeed();

