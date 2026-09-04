const router = require('express').Router();
const ctrl = require('../controllers/purchase.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

const canManagePurchases = authorize('SUPER_ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER');

router.get('/', canManagePurchases, ctrl.listPurchaseOrders);
router.get('/:id', canManagePurchases, ctrl.getPurchaseOrder);
router.post('/', canManagePurchases, ctrl.createPurchaseOrder);
router.patch('/:id', canManagePurchases, ctrl.updatePurchaseOrder);
router.patch('/:id/mark-ordered', canManagePurchases, ctrl.markOrdered);
router.post('/:id/receive', authorize('SUPER_ADMIN', 'STOCK_MANAGER'), ctrl.receivePurchaseOrder);
router.delete('/:id', authorize('SUPER_ADMIN', 'ACCOUNTANT'), ctrl.deletePurchaseOrder);

module.exports = router;
