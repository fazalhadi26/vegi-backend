const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const Product = require('../models/Product');
const Category = require('../models/Category');

// @desc    List products with category filtering, search, sorting, and pagination
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const { category, search, isAvailable, sort, minPrice, maxPrice, page = 1, limit = 50 } = req.query;

    if (getMongoStatus()) {
      let query = { isArchived: false };

      if (category) {
        query.categoryId = category;
      }
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
        ];
      }
      if (isAvailable !== undefined) {
        query.isAvailable = isAvailable === 'true';
      }
      if (minPrice || maxPrice) {
        query.sellingPrice = {};
        if (minPrice) query.sellingPrice.$gte = Number(minPrice);
        if (maxPrice) query.sellingPrice.$lte = Number(maxPrice);
      }

      let sortOptions = { createdAt: -1 };
      if (sort === 'price-asc') sortOptions = { sellingPrice: 1 };
      if (sort === 'price-desc') sortOptions = { sellingPrice: -1 };
      if (sort === 'name-asc') sortOptions = { name: 1 };

      const skip = (Number(page) - 1) * Number(limit);
      const total = await Product.countDocuments(query);
      const products = await Product.find(query)
        .populate('categoryId', 'name slug')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit));

      return res.status(200).json({
        success: true,
        count: products.length,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        data: products,
      });
    } else {
      // In-Memory
      let result = store.products.filter((p) => !p.isArchived);

      if (category) {
        result = result.filter((p) => p.categoryId === category || (p.category && p.category.slug === category));
      }
      if (search) {
        const s = search.toLowerCase();
        result = result.filter(
          (p) =>
            p.name.toLowerCase().includes(s) ||
            p.description.toLowerCase().includes(s) ||
            p.sku.toLowerCase().includes(s)
        );
      }
      if (isAvailable !== undefined) {
        const avail = isAvailable === 'true';
        result = result.filter((p) => p.isAvailable === avail);
      }
      if (minPrice) {
        result = result.filter((p) => p.sellingPrice >= Number(minPrice));
      }
      if (maxPrice) {
        result = result.filter((p) => p.sellingPrice <= Number(maxPrice));
      }

      if (sort === 'price-asc') {
        result.sort((a, b) => a.sellingPrice - b.sellingPrice);
      } else if (sort === 'price-desc') {
        result.sort((a, b) => b.sellingPrice - a.sellingPrice);
      } else if (sort === 'name-asc') {
        result.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Attach category name
      const populated = result.map((p) => {
        const cat = store.categories.find((c) => c._id === p.categoryId);
        return {
          ...p,
          categoryId: cat ? { _id: cat._id, name: cat.name, slug: cat.slug } : p.categoryId,
        };
      });

      const skip = (Number(page) - 1) * Number(limit);
      const paginated = populated.slice(skip, skip + Number(limit));

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

// @desc    Get single product details
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (getMongoStatus()) {
      const product = await Product.findById(id).populate('categoryId', 'name slug');
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.status(200).json({ success: true, data: product });
    } else {
      const product = store.products.find((p) => p._id === id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      const cat = store.categories.find((c) => c._id === product.categoryId);
      return res.status(200).json({
        success: true,
        data: {
          ...product,
          categoryId: cat ? { _id: cat._id, name: cat.name, slug: cat.slug } : product.categoryId,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res, next) => {
  try {
    if (getMongoStatus()) {
      const featured = await Product.find({ isFeatured: true, isArchived: false, isAvailable: true })
        .populate('categoryId', 'name slug')
        .limit(10);
      return res.status(200).json({ success: true, count: featured.length, data: featured });
    } else {
      const featured = store.products
        .filter((p) => p.isFeatured && !p.isArchived && p.isAvailable)
        .map((p) => {
          const cat = store.categories.find((c) => c._id === p.categoryId);
          return {
            ...p,
            categoryId: cat ? { _id: cat._id, name: cat.name, slug: cat.slug } : p.categoryId,
          };
        });
      return res.status(200).json({ success: true, count: featured.length, data: featured });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
const searchProducts = async (req, res, next) => {
  try {
    const query = req.query.q || '';
    if (!query) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    if (getMongoStatus()) {
      const products = await Product.find({
        isArchived: false,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { sku: { $regex: query, $options: 'i' } },
        ],
      }).populate('categoryId', 'name slug');
      return res.status(200).json({ success: true, count: products.length, data: products });
    } else {
      const s = query.toLowerCase();
      const results = store.products
        .filter(
          (p) =>
            !p.isArchived &&
            (p.name.toLowerCase().includes(s) ||
              p.description.toLowerCase().includes(s) ||
              p.sku.toLowerCase().includes(s))
        )
        .map((p) => {
          const cat = store.categories.find((c) => c._id === p.categoryId);
          return {
            ...p,
            categoryId: cat ? { _id: cat._id, name: cat.name, slug: cat.slug } : p.categoryId,
          };
        });
      return res.status(200).json({ success: true, count: results.length, data: results });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Create product (Admin)
// @route   POST /api/products
// @access  Private (Admin)
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      sku,
      description,
      categoryId,
      images,
      buyingPrice,
      sellingPrice,
      discountPrice,
      stockQuantity,
      unit,
      lowStockThreshold,
      origin,
      isAvailable,
      isFeatured,
    } = req.body;

    if (!name || !sellingPrice || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Name, selling price, and unit are required fields.',
      });
    }

    const generatedSku = sku || `QFV-${name.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    if (getMongoStatus()) {
      const product = await Product.create({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        sku: generatedSku,
        description: description || '',
        categoryId,
        images: Array.isArray(images) ? images : images ? [images] : [],
        buyingPrice: Number(buyingPrice) || 0,
        sellingPrice: Number(sellingPrice),
        discountPrice: discountPrice ? Number(discountPrice) : null,
        stockQuantity: Number(stockQuantity) || 0,
        unit: unit || 'kg',
        lowStockThreshold: Number(lowStockThreshold) || 10,
        origin: origin || 'Qatar (Local Produce)',
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        isFeatured: Boolean(isFeatured),
      });

      return res.status(201).json({
        success: true,
        message: 'Product created successfully.',
        data: product,
      });
    } else {
      const newProduct = {
        _id: store.generateId(),
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        sku: generatedSku,
        description: description || '',
        categoryId: categoryId || (store.categories[0] ? store.categories[0]._id : '64a000000000000000000001'),
        images: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=700&q=80'],
        buyingPrice: Number(buyingPrice) || 0,
        sellingPrice: Number(sellingPrice),
        discountPrice: discountPrice ? Number(discountPrice) : null,
        stockQuantity: Number(stockQuantity) || 0,
        unit: unit || 'kg',
        lowStockThreshold: Number(lowStockThreshold) || 10,
        origin: origin || 'Qatar (Local Produce)',
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        isFeatured: Boolean(isFeatured),
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.products.unshift(newProduct);

      // Record inventory movement for initial stock if > 0
      if (newProduct.stockQuantity > 0) {
        store.inventoryMovements.unshift({
          _id: store.generateId(),
          productId: newProduct._id,
          productName: newProduct.name,
          quantityAdded: newProduct.stockQuantity,
          quantityRemoved: 0,
          currentStockAfter: newProduct.stockQuantity,
          reason: 'Initial Stock',
          batchNumber: `BATCH-INIT-${Date.now()}`,
          supplierName: origin || 'Qatar Local Farm',
          recordedBy: req.user ? req.user.fullName : 'Admin',
          createdAt: new Date(),
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Product created successfully.',
        data: newProduct,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update product (Admin)
// @route   PUT /api/products/:id
// @access  Private (Admin)
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (getMongoStatus()) {
      const product = await Product.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.status(200).json({ success: true, message: 'Product updated successfully.', data: product });
    } else {
      const index = store.products.findIndex((p) => p._id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }

      store.products[index] = {
        ...store.products[index],
        ...req.body,
        updatedAt: new Date(),
      };

      return res.status(200).json({
        success: true,
        message: 'Product updated successfully.',
        data: store.products[index],
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Archive/Soft Delete product (Admin)
// @route   DELETE /api/products/:id
// @access  Private (Admin)
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (getMongoStatus()) {
      const product = await Product.findByIdAndUpdate(id, { isArchived: true, isAvailable: false }, { new: true });
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.status(200).json({ success: true, message: 'Product archived successfully.' });
    } else {
      const product = store.products.find((p) => p._id === id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      product.isArchived = true;
      product.isAvailable = false;
      return res.status(200).json({ success: true, message: 'Product archived successfully.' });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  getFeaturedProducts,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};

