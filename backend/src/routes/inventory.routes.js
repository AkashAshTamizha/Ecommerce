const router = require('express').Router();
const ctrl = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

const canManageStock = authorize('SUPER_ADMIN', 'SELLER', 'STOCK_MANAGER');

router.get('/', ctrl.listInventory);
router.get('/low-stock', ctrl.lowStockReport);
router.get('/movements', ctrl.listMovements);

router.post('/stock-in', canManageStock, ctrl.stockIn);
router.post('/stock-out', canManageStock, ctrl.stockOut);
router.post('/adjustment', canManageStock, ctrl.adjustment);
router.post('/transfer', canManageStock, ctrl.transfer);
router.patch('/:id/reorder-settings', canManageStock, ctrl.updateReorderSettings);
router.patch('/:id/accounting-stock', canManageStock, ctrl.updateAccountingStock);

module.exports = router;
