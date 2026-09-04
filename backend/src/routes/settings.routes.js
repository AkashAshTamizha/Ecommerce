const router = require('express').Router();
const ctrl = require('../controllers/settings.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ACCOUNTANT'), ctrl.getSettings);
router.patch('/', authorize('SUPER_ADMIN'), ctrl.updateSettings);

module.exports = router;
