const prisma = require('../config/db');

let ioInstance = null;
function attachIO(io) {
  ioInstance = io;
}

/**
 * Creates a notification either for a specific userId, or broadcast to
 * every user with a given role (e.g. all SUPER_ADMIN accounts).
 * Emits a real-time 'notification' event over socket.io if attached.
 */
async function createNotification({ userId, role, title, message, type = 'INFO' }) {
  let targetUserIds = [];

  if (userId) {
    targetUserIds = [userId];
  } else if (role) {
    const users = await prisma.user.findMany({ where: { role, isActive: true }, select: { id: true } });
    targetUserIds = users.map((u) => u.id);
  }

  if (!targetUserIds.length) return [];

  const notifications = await prisma.$transaction(
    targetUserIds.map((id) =>
      prisma.notification.create({ data: { userId: id, title, message, type } })
    )
  );

  if (ioInstance) {
    notifications.forEach((n) => ioInstance.to(`user:${n.userId}`).emit('notification', n));
  }

  return notifications;
}

module.exports = { createNotification, attachIO };
