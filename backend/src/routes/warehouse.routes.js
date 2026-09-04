const router = require('express').Router();
const ctrl = require('../controllers/warehouse.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', ctrl.listWarehouses);
router.get('/:id', ctrl.getWarehouse);

router.post('/', authorize('SUPER_ADMIN', 'SELLER'), ctrl.createWarehouse);
router.patch('/:id', authorize('SUPER_ADMIN', 'SELLER'), ctrl.updateWarehouse);
router.delete('/:id', authorize('SUPER_ADMIN'), ctrl.deleteWarehouse);

router.post('/:id/staff', authorize('SUPER_ADMIN', 'SELLER'), ctrl.assignStaff);
router.delete('/:id/staff/:userId', authorize('SUPER_ADMIN', 'SELLER'), ctrl.removeStaff);

module.exports = router;
