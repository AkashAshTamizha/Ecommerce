const router = require('express').Router();
const ctrl = require('../controllers/review.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Public — anyone can read a product's approved reviews.
router.get('/products/:productId', ctrl.listProductReviews);

// Everything else requires a logged-in customer.
router.get('/products/:productId/eligibility', authenticate, authorize('CUSTOMER'), ctrl.getReviewEligibility);
router.post('/products/:productId', authenticate, authorize('CUSTOMER'), ctrl.createReview);
router.delete('/:id', authenticate, authorize('CUSTOMER'), ctrl.deleteMyReview);

module.exports = router;
