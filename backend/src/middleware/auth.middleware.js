const { verifyAccessToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiResponse');
const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Requires a valid access token (Bearer header or httpOnly cookie).
 * Attaches `req.user = { id, role, email }` on success.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearerToken || req.cookies?.accessToken;

  if (!token) {
    throw new ApiError(401, 'Authentication required. Please log in.');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Session expired. Please refresh your token.');
    }
    throw new ApiError(401, 'Invalid authentication token.');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, email: true, role: true, isActive: true, name: true },
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Account not found or deactivated.');
  }

  req.user = user;
  next();
});

/**
 * Restricts a route to specific roles.
 * Usage: router.get('/admin-only', authenticate, authorize('SUPER_ADMIN'), handler)
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    throw new ApiError(403, 'You do not have permission to perform this action.');
  }
  next();
};

module.exports = { authenticate, authorize };
