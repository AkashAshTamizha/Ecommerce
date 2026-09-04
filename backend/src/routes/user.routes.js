const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/', ctrl.listUsers);
router.get('/:id', ctrl.getUser);
router.post('/', ctrl.createUser);
router.patch('/:id', ctrl.updateUser);
router.patch('/:id/deactivate', ctrl.deactivateUser);
router.patch('/:id/activate', ctrl.activateUser);

module.exports = router;
