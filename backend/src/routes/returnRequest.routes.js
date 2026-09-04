const router = require('express').Router();
const ctrl = require('../controllers/returnRequest.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// STOCK_MANAGER drives the physical workflow (approve/pickup/received/ship),
// ACCOUNTANT additionally owns the refund step, SUPER_ADMIN can do it all —
// mirrors the split already used for vendor returns.
const canManage = authorize('SUPER_ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER');
const canRefund = authorize('SUPER_ADMIN', 'ACCOUNTANT');

router.get('/mine', authorize('CUSTOMER'), ctrl.listMyReturnRequests);
router.post('/', authorize('CUSTOMER'), ctrl.createReturnRequest);
router.patch('/:id/cancel', authorize('CUSTOMER'), ctrl.cancelMyReturnRequest);

router.get('/', canManage, ctrl.listReturnRequests);
router.get('/:id', ctrl.getReturnRequest); // authorization handled inside (own claim vs staff role)

router.patch('/:id/approve', canManage, ctrl.approveReturnRequest);
router.patch('/:id/reject', canManage, ctrl.rejectReturnRequest);
router.patch('/:id/schedule-pickup', canManage, ctrl.schedulePickup);
router.patch('/:id/mark-picked-up', canManage, ctrl.markPickedUp);
router.patch('/:id/mark-received', canManage, ctrl.markReceived);
router.patch('/:id/refund', canRefund, ctrl.refundReturnRequest);
router.patch('/:id/ship-replacement', canManage, ctrl.shipReplacement);
router.patch('/:id/deliver-replacement', canManage, ctrl.deliverReplacement);

module.exports = router;
