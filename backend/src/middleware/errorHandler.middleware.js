const { ApiError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || [];

  // Prisma known errors
  if (err.code === 'P2002') {
    statusCode = 409;
    message = `Duplicate value for field: ${err.meta?.target?.join(', ') || 'unknown'}`;
  }
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  }
  if (err.code === 'P2003') {
    statusCode = 409;
    message = 'This record is referenced by other data and cannot be modified.';
  }

  // Multer errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = `Upload error: ${err.message}`;
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${message}`, { stack: err.stack });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} - ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = { errorHandler, notFound };
