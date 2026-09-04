const { body } = require('express-validator');

const createProductRules = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('categoryId').notEmpty().withMessage('Category is required'),
  body('shortDesc').trim().notEmpty().withMessage('Short description is required').isLength({ max: 200 }),
  body('mrp').isFloat({ gt: 0 }).withMessage('MRP must be a positive number'),
  body('sellingPrice').isFloat({ gt: 0 }).withMessage('Selling price must be a positive number'),
  body('minStockLevel').optional().isInt({ min: 0 }),
  body('maxStockLevel').optional().isInt({ min: 0 }),
];

module.exports = { createProductRules };
