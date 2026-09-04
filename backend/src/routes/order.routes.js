const router = require('express').Router();
const ctrl = require('../controllers/order.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

const canViewOrders = authorize('SUPER_ADMIN', 'SELLER', 'ACCOUNTANT', 'STOCK_MANAGER');

router.get('/', canViewOrders, ctrl.listOrders);
router.get('/mine', authorize('CUSTOMER'), ctrl.listMyOrders);
router.post('/', authorize('CUSTOMER'), ctrl.checkout);
router.get('/:id', ctrl.getOrder); // authorization handled inside (own order vs staff role)
router.patch('/:id/status', authorize('SUPER_ADMIN', 'SELLER', 'STOCK_MANAGER'), ctrl.updateOrderStatus);
router.patch('/:id/payment-status', authorize('SUPER_ADMIN', 'ACCOUNTANT'), ctrl.updatePaymentStatus);
router.patch('/:id/cancel', authorize('CUSTOMER'), ctrl.cancelMyOrder);

module.exports = router;
