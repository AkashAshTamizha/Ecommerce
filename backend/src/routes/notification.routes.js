const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', ctrl.listMyNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.patch('/read-all', ctrl.markAllAsRead);
router.patch('/:id/read', ctrl.markAsRead);

module.exports = router;
