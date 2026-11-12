const { defaultAdmin, defaultCustomers, categories: seedCategories, products: seedProducts, coupons: seedCoupons, defaultSettings } = require('../utils/seedData');

// In-Memory Data Store (Provides 100% resilient fallback and instant demo mode if MongoDB is not locally running)
class QatarFreshVegStore {
  constructor() {
    this.users = [];
    this.categories = [];
    this.products = [];
    this.carts = {}; // userId -> items[]
    this.addresses = [];
    this.orders = [];
    this.inventoryMovements = [];
    this.coupons = [];
    this.deliveries = [];
    this.settings = { ...defaultSettings };
    this.isInitialized = false;

    this.init();
  }

  init() {
    if (this.isInitialized) return;

    // Seed Admin
    this.users.push({
      _id: '64f000000000000000000001',
      ...defaultAdmin,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Customers
    defaultCustomers.forEach((cust, idx) => {
      this.users.push({
        _id: `64f00000000000000000000${idx + 2}`,
        ...cust,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Seed Categories
    this.categories = JSON.parse(JSON.stringify(seedCategories));

    // Seed Products
    this.products = JSON.parse(JSON.stringify(seedProducts));

    // Seed Coupons
    this.coupons = JSON.parse(JSON.stringify(seedCoupons));

    // Seed Sample Addresses for demo customer (Hamad Al-Thani)
    this.addresses.push(
      {
        _id: '64d000000000000000000001',
        userId: '64f000000000000000000002',
        fullName: 'Hamad Al-Thani',
        phoneNumber: '+974 6611 2233',
        zone: 'Zone 66 (West Bay Lagoon)',
        street: 'Street 850, Diplomatic Area',
        building: 'Villa 14',
        apartment: '',
        instructions: 'Call upon arrival at the gate',
        isDefault: true,
        createdAt: new Date(),
      },
      {
        _id: '64d000000000000000000002',
        userId: '64f000000000000000000002',
        fullName: 'Hamad Al-Thani (Office)',
        phoneNumber: '+974 6611 2233',
        zone: 'Zone 61 (Dafna)',
        street: 'Majlis Al Taawon St',
        building: 'Al Fardan Tower 2',
        apartment: 'Level 18, Suite 1804',
        instructions: 'Deliver to 18th floor reception desk',
        isDefault: false,
        createdAt: new Date(),
      }
    );

    // Seed Sample Orders
    const sampleDate = new Date();
    this.orders.push(
      {
        _id: '64e000000000000000000001',
        orderNumber: 'QFV-20261110-101',
        userId: '64f000000000000000000002',
        customerName: 'Hamad Al-Thani',
        customerPhone: '+974 6611 2233',
        items: [
          {
            productId: '64b000000000000000000001',
            name: 'Qatar Farm Fresh Cucumbers',
            sku: 'QFV-CUC-001',
            unit: 'kg',
            price: 3.75,
            quantity: 3,
            total: 11.25,
            image: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=700&q=80',
          },
          {
            productId: '64b000000000000000000002',
            name: 'Greenhouse Vine Tomatoes',
            sku: 'QFV-TOM-002',
            unit: 'kg',
            price: 4.90,
            quantity: 2,
            total: 9.80,
            image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=700&q=80',
          },
          {
            productId: '64b000000000000000000003',
            name: 'Fresh Local Rocca (Arugula)',
            sku: 'QFV-ROC-003',
            unit: 'bunch',
            price: 1.50,
            quantity: 4,
            total: 6.00,
            image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=700&q=80',
          },
          {
            productId: '64b000000000000000000011',
            name: 'Hydroponic Sweet Cherry Tomatoes',
            sku: 'QFV-CHR-011',
            unit: '500g',
            price: 10.50,
            quantity: 2,
            total: 21.00,
            image: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=700&q=80',
          },
        ],
        subtotal: 48.05,
        deliveryFee: 10.00,
        discount: 4.80,
        couponCode: 'QATARFRESH10',
        totalAmount: 53.25,
        currency: 'QAR',
        addressSnapshot: {
          fullName: 'Hamad Al-Thani',
          phoneNumber: '+974 6611 2233',
          zone: 'Zone 66 (West Bay Lagoon)',
          street: 'Street 850, Diplomatic Area',
          building: 'Villa 14',
          apartment: '',
          instructions: 'Call upon arrival at the gate',
        },
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Pending',
        orderStatus: 'Out for Delivery',
        deliverySlot: 'Express Delivery (within 2 hours)',
        deliveryPersonId: '64f000000000000000000005',
        deliveryPersonName: 'Tariq Delivery Lead',
        deliveryPersonPhone: '+974 5599 8877',
        statusTimeline: [
          { status: 'Pending', timestamp: new Date(Date.now() - 3600000 * 2), note: 'Order placed by customer' },
          { status: 'Confirmed', timestamp: new Date(Date.now() - 3600000 * 1.5), note: 'Accepted by Doha Hub Dispatch' },
          { status: 'Preparing', timestamp: new Date(Date.now() - 3600000 * 1), note: 'Fresh vegetables picked and chilled' },
          { status: 'Ready for Delivery', timestamp: new Date(Date.now() - 3600000 * 0.5), note: 'Loaded into refrigerated van' },
          { status: 'Out for Delivery', timestamp: new Date(), note: 'Driver en route in West Bay' },
        ],
        notes: 'Handle tomatoes with care',
        createdAt: new Date(Date.now() - 3600000 * 2),
        updatedAt: new Date(),
      },
      {
        _id: '64e000000000000000000002',
        orderNumber: 'QFV-20261109-088',
        userId: '64f000000000000000000003',
        customerName: 'Fatima Al-Kuwari',
        customerPhone: '+974 7722 3344',
        items: [
          {
            productId: '64b000000000000000000005',
            name: 'Tricolor Bell Peppers (Capsicum)',
            sku: 'QFV-PEP-005',
            unit: 'kg',
            price: 8.50,
            quantity: 2,
            total: 17.00,
            image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=700&q=80',
          },
          {
            productId: '64b000000000000000000010',
            name: 'All-Purpose Fresh Potatoes',
            sku: 'QFV-POT-010',
            unit: 'kg',
            price: 3.50,
            quantity: 5,
            total: 17.50,
            image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=700&q=80',
          },
        ],
        subtotal: 34.50,
        deliveryFee: 10.00,
        discount: 0,
        couponCode: null,
        totalAmount: 44.50,
        currency: 'QAR',
        addressSnapshot: {
          fullName: 'Fatima Al-Kuwari',
          phoneNumber: '+974 7722 3344',
          zone: 'Zone 69 (Lusail)',
          street: 'Marina Promenade St',
          building: 'Lusail Tower A',
          apartment: 'Apartment 902',
          instructions: 'Leave at front desk with security',
        },
        paymentMethod: 'Card on Delivery',
        paymentStatus: 'Paid',
        orderStatus: 'Delivered',
        deliverySlot: 'Morning Slot (09:00 - 12:00)',
        deliveryPersonId: '64f000000000000000000005',
        deliveryPersonName: 'Tariq Delivery Lead',
        deliveryPersonPhone: '+974 5599 8877',
        statusTimeline: [
          { status: 'Pending', timestamp: new Date(Date.now() - 86400000), note: 'Order placed' },
          { status: 'Confirmed', timestamp: new Date(Date.now() - 82800000), note: 'Confirmed' },
          { status: 'Preparing', timestamp: new Date(Date.now() - 79200000), note: 'Packed' },
          { status: 'Ready for Delivery', timestamp: new Date(Date.now() - 75600000), note: 'Ready' },
          { status: 'Out for Delivery', timestamp: new Date(Date.now() - 72000000), note: 'Out for delivery' },
          { status: 'Delivered', timestamp: new Date(Date.now() - 68400000), note: 'Delivered to customer' },
        ],
        notes: '',
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 68400000),
      }
    );

    // Seed Sample Inventory Movements
    this.inventoryMovements.push(
      {
        _id: '64c000000000000000000001',
        productId: '64b000000000000000000001',
        productName: 'Qatar Farm Fresh Cucumbers',
        quantityAdded: 150,
        quantityRemoved: 0,
        currentStockAfter: 150,
        reason: 'Incoming Supplier Stock',
        batchNumber: 'BATCH-QTR-20261110-01',
        supplierName: 'Al Khor Local Hydro Farm',
        expiryDate: new Date(Date.now() + 86400000 * 7),
        recordedBy: 'Admin',
        createdAt: new Date(Date.now() - 3600000 * 12),
      },
      {
        _id: '64c000000000000000000002',
        productId: '64b000000000000000000001',
        productName: 'Qatar Farm Fresh Cucumbers',
        quantityAdded: 0,
        quantityRemoved: 3,
        currentStockAfter: 147,
        reason: 'Customer Order Fulfillment',
        batchNumber: 'BATCH-QTR-20261110-01',
        supplierName: 'Al Khor Local Hydro Farm',
        expiryDate: new Date(Date.now() + 86400000 * 7),
        recordedBy: 'Order System',
        createdAt: new Date(Date.now() - 3600000 * 2),
      },
      {
        _id: '64c000000000000000000003',
        productId: '64b000000000000000000007',
        productName: 'Glossy Black Eggplant (Aubergine)',
        quantityAdded: 0,
        quantityRemoved: 2,
        currentStockAfter: 45,
        reason: 'Damaged / Spoiled Waste',
        batchNumber: 'BATCH-EGG-20261108',
        supplierName: 'Qatar Local Produce',
        expiryDate: null,
        recordedBy: 'QA Inspector Tariq',
        createdAt: new Date(Date.now() - 3600000 * 8),
      }
    );

    this.isInitialized = true;
  }

  // Helper ID generator
  generateId() {
    return '64' + Math.random().toString(16).substring(2, 24).padEnd(22, '0');
  }
}

const storeInstance = new QatarFreshVegStore();

module.exports = storeInstance;

