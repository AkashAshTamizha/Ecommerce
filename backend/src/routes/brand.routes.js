const router = require('express').Router();
const ctrl = require('../controllers/brand.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/', ctrl.listBrands);
router.post('/', authenticate, authorize('SUPER_ADMIN'), ctrl.createBrand);
router.patch('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.updateBrand);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.deleteBrand);

module.exports = router;
