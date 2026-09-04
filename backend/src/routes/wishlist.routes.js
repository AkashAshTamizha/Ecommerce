const router = require('express').Router();
const ctrl = require('../controllers/wishlist.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate, authorize('CUSTOMER'));

router.get('/', ctrl.getWishlist);
router.post('/', ctrl.addToWishlist);
router.delete('/:productId', ctrl.removeFromWishlist);

module.exports = router;
