const router = require('express').Router();
const ctrl = require('../controllers/address.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate, authorize('CUSTOMER'));

router.get('/', ctrl.listAddresses);
router.post('/', ctrl.createAddress);
router.patch('/:id', ctrl.updateAddress);
router.delete('/:id', ctrl.deleteAddress);

module.exports = router;
