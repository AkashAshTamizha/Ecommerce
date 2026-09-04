const { body } = require('express-validator');

const createOfferRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('type').optional().isIn(['COUPON', 'AUTOMATIC']).withMessage('type must be COUPON or AUTOMATIC'),
  body('discountType').optional().isIn(['PERCENTAGE', 'FIXED']).withMessage('discountType must be PERCENTAGE or FIXED'),
  body('discountValue').isFloat({ gt: 0 }).withMessage('discountValue must be a positive number'),
  body('scope').optional().isIn(['ALL', 'CATEGORY', 'BRAND', 'PRODUCT']).withMessage('Invalid scope'),
  body('code')
    .if(body('type').equals('COUPON'))
    .trim()
    .notEmpty()
    .withMessage('code is required for coupon offers')
    .isLength({ min: 3, max: 30 })
    .withMessage('code must be between 3 and 30 characters'),
  body('minOrderAmount').optional().isFloat({ min: 0 }),
  body('maxDiscountAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('usageLimit').optional({ nullable: true }).isInt({ min: 1 }),
  body('usageLimitPerUser').optional({ nullable: true }).isInt({ min: 1 }),
  body('startsAt').optional({ nullable: true }).isISO8601(),
  body('endsAt').optional({ nullable: true }).isISO8601(),
];

const applyCouponRules = [
  body('code').trim().notEmpty().withMessage('code is required'),
];

module.exports = { createOfferRules, applyCouponRules };
