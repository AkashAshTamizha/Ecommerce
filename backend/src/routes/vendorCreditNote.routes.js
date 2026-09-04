const router = require('express').Router();
const ctrl = require('../controllers/vendorCreditNote.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

const canManageCreditNotes = authorize('SUPER_ADMIN', 'ACCOUNTANT');

router.get('/', canManageCreditNotes, ctrl.listVendorCreditNotes);
router.get('/:id', canManageCreditNotes, ctrl.getVendorCreditNote);
router.post('/', canManageCreditNotes, ctrl.createVendorCreditNote);
router.post('/:id/apply', canManageCreditNotes, ctrl.applyVendorCreditNote);
router.patch('/:id/cancel', canManageCreditNotes, ctrl.cancelVendorCreditNote);

module.exports = router;
