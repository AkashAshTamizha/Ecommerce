const router = require('express').Router();
const ctrl = require('../controllers/shipment.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

const canManage = authorize('SUPER_ADMIN', 'SELLER', 'STOCK_MANAGER');
const canView = authorize('SUPER_ADMIN', 'SELLER', 'STOCK_MANAGER', 'ACCOUNTANT', 'DELIVERY_AGENT');

router.get('/', canView, ctrl.listShipments);
router.get('/stats', canView, ctrl.shipmentStats);
router.get('/agents/available', canManage, ctrl.listDeliveryAgents);
router.get('/:id', canView, ctrl.getShipment);

router.post('/', canManage, ctrl.createShipment);
router.patch('/:id/status', authorize('SUPER_ADMIN', 'SELLER', 'STOCK_MANAGER', 'DELIVERY_AGENT'), ctrl.updateShipmentStatus);
router.patch('/:id/assign', canManage, ctrl.assignDeliveryAgent);
router.patch('/:id/courier', canManage, ctrl.updateCourierInfo);

module.exports = router;
