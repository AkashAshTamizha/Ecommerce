require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const logger = require('./utils/logger');
const { attachIO } = require('./services/notification.service');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// ---- Socket.io for real-time notifications ----
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
    credentials: true,
  },
});

io.on('connection', (socket) => {
  // Client joins a private room keyed by their userId after authenticating,
  // e.g. socket.emit('join', userId) from the frontend once logged in.
  socket.on('join', (userId) => {
    if (userId) socket.join(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

attachIO(io);

server.listen(PORT, () => {
  logger.info(`🚀 API server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// ---- Graceful shutdown ----
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});
