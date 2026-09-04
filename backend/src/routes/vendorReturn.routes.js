const router = require('express').Router();
const ctrl = require('../controllers/vendorReturn.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

const canManageReturns = authorize('SUPER_ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER');

router.get('/', canManageReturns, ctrl.listVendorReturns);
router.get('/:id', canManageReturns, ctrl.getVendorReturn);
router.post('/', canManageReturns, ctrl.createVendorReturn);
router.patch('/:id', canManageReturns, ctrl.updateVendorReturn);
router.patch('/:id/send', canManageReturns, ctrl.sendVendorReturn);
router.patch('/:id/acknowledge', canManageReturns, ctrl.acknowledgeVendorReturn);
router.post('/:id/resolve', authorize('SUPER_ADMIN', 'ACCOUNTANT'), ctrl.resolveVendorReturn);
router.patch('/:id/cancel', canManageReturns, ctrl.cancelVendorReturn);
router.delete('/:id', authorize('SUPER_ADMIN', 'ACCOUNTANT'), ctrl.deleteVendorReturn);

module.exports = router;
