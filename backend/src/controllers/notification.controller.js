const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');

// GET /api/v1/notifications
const listMyNotifications = asyncHandler(async (req, res) => {
  const { skip, take, page, limit } = getPagination(req.query, { allowedSort: ['createdAt'] });
  const where = { userId: req.user.id };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
  ]);

  return success(res, 200, 'Notifications fetched', { notifications, unreadCount }, buildMeta({ page, limit }, total));
});

// GET /api/v1/notifications/unread-count
// Lightweight endpoint for a header badge to poll without pulling the list.
const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
  return success(res, 200, 'Unread count fetched', { unreadCount });
});

// PATCH /api/v1/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.user.id) {
    throw new ApiError(404, 'Notification not found.');
  }
  const updated = await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });
  return success(res, 200, 'Notification marked as read', updated);
});

// PATCH /api/v1/notifications/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  return success(res, 200, 'All notifications marked as read');
});

module.exports = { listMyNotifications, getUnreadCount, markAsRead, markAllAsRead };
