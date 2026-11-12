const store = require('../config/store');
const { getMongoStatus } = require('../config/db');
const Category = require('../models/Category');

// @desc    List all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
    if (getMongoStatus()) {
      const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
      return res.status(200).json({ success: true, count: categories.length, data: categories });
    } else {
      const categories = store.categories.filter((c) => c.isActive);
      return res.status(200).json({ success: true, count: categories.length, data: categories });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Create category (Admin)
// @route   POST /api/categories
// @access  Private (Admin)
const createCategory = async (req, res, next) => {
  try {
    const { name, description, image, icon, displayOrder } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (getMongoStatus()) {
      const cat = await Category.create({
        name,
        slug,
        description: description || '',
        image: image || '',
        icon: icon || 'Leaf',
        displayOrder: displayOrder || 0,
        isActive: true,
      });
      return res.status(201).json({ success: true, message: 'Category created successfully.', data: cat });
    } else {
      const newCat = {
        _id: store.generateId(),
        name,
        slug,
        description: description || '',
        image: image || 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&q=80',
        icon: icon || 'Leaf',
        displayOrder: displayOrder || store.categories.length + 1,
        isActive: true,
        createdAt: new Date(),
      };
      store.categories.push(newCat);
      return res.status(201).json({ success: true, message: 'Category created successfully.', data: newCat });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update category (Admin)
// @route   PUT /api/categories/:id
// @access  Private (Admin)
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (getMongoStatus()) {
      const cat = await Category.findByIdAndUpdate(id, req.body, { new: true });
      if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
      return res.status(200).json({ success: true, message: 'Category updated successfully.', data: cat });
    } else {
      const index = store.categories.findIndex((c) => c._id === id);
      if (index === -1) return res.status(404).json({ success: false, message: 'Category not found.' });
      store.categories[index] = { ...store.categories[index], ...req.body };
      return res.status(200).json({ success: true, message: 'Category updated successfully.', data: store.categories[index] });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/Toggle Category (Admin)
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (getMongoStatus()) {
      await Category.findByIdAndUpdate(id, { isActive: false });
      return res.status(200).json({ success: true, message: 'Category deactivated successfully.' });
    } else {
      const cat = store.categories.find((c) => c._id === id);
      if (cat) cat.isActive = false;
      return res.status(200).json({ success: true, message: 'Category deactivated successfully.' });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};

