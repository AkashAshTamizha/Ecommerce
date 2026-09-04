const router = require('express').Router();
const ctrl = require('../controllers/vendor.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

const canManageVendors = authorize('SUPER_ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER');

router.get('/', canManageVendors, ctrl.listVendors);
router.get('/:id', canManageVendors, ctrl.getVendor);
router.post('/', canManageVendors, ctrl.createVendor);
router.patch('/:id', canManageVendors, ctrl.updateVendor);
router.delete('/:id', authorize('SUPER_ADMIN'), ctrl.deleteVendor);

module.exports = router;
