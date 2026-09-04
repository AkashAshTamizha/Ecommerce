const router = require('express').Router();
const ctrl = require('../controllers/offer.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createOfferRules, applyCouponRules } = require('../validators/offer.validator');

// -------------------- Public / customer (specific paths first) --------------------
router.get('/active', ctrl.listActiveOffers);
router.post('/apply', authenticate, authorize('CUSTOMER'), validate(applyCouponRules), ctrl.applyCoupon);
router.get('/best-automatic', authenticate, authorize('CUSTOMER'), ctrl.getBestAutomaticOffer);

// -------------------- Admin --------------------
router.get('/', authenticate, authorize('SUPER_ADMIN'), ctrl.listOffers);
router.get('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.getOffer);
router.post('/', authenticate, authorize('SUPER_ADMIN'), validate(createOfferRules), ctrl.createOffer);
router.patch('/:id/toggle', authenticate, authorize('SUPER_ADMIN'), ctrl.toggleOffer);
router.patch('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.updateOffer);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.deleteOffer);

module.exports = router;
