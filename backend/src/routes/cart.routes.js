const router = require('express').Router();
const ctrl = require('../controllers/cart.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate, authorize('CUSTOMER'));

router.get('/', ctrl.getCart);
router.post('/', ctrl.addToCart);
router.patch('/:id', ctrl.updateCartItem);
router.delete('/:id', ctrl.removeCartItem);
router.delete('/', ctrl.clearCart);

module.exports = router;
