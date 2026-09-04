const router = require('express').Router();
const ctrl = require('../controllers/seller.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ACCOUNTANT'), ctrl.listSellers);
router.get('/:id', authorize('SUPER_ADMIN', 'ACCOUNTANT'), ctrl.getSeller);
router.patch('/:id', authorize('SUPER_ADMIN'), ctrl.updateSeller);
router.patch('/:id/status', authorize('SUPER_ADMIN'), ctrl.updateSellerStatus);

module.exports = router;
