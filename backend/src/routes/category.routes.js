const router = require('express').Router();
const ctrl = require('../controllers/category.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/', ctrl.listCategories);
router.post('/', authenticate, authorize('SUPER_ADMIN'), ctrl.createCategory);
router.patch('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.updateCategory);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.deleteCategory);

module.exports = router;
