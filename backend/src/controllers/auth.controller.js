const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function issueTokens(user) {
  const payload = { sub: user.id, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

// POST /api/v1/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  // Only SELLER/CUSTOMER can self-register; SUPER_ADMIN is seeded/created manually.
  const safeRole = ['SELLER', 'CUSTOMER'].includes(role) ? role : 'CUSTOMER';

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role: safeRole },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  // Sellers start with a pending Seller profile that needs Super Admin approval
  if (safeRole === 'SELLER') {
    await prisma.seller.create({
      data: { userId: user.id, storeName: `${name}'s Store` },
    });
  }

  const { accessToken, refreshToken } = issueTokens(user);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

  res.cookie('accessToken', accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, cookieOpts);

  return success(res, 201, 'Account created successfully', { user, accessToken });
});

// POST /api/v1/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, 'Invalid email or password.');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated.');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new ApiError(401, 'Invalid email or password.');

  const { accessToken, refreshToken } = issueTokens(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken, lastLoginAt: new Date() },
  });

  res.cookie('accessToken', accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, cookieOpts);

  const { passwordHash: _omit, refreshToken: _omit2, ...safeUser } = user;

  return success(res, 200, 'Logged in successfully', { user: safeUser, accessToken });
});

// POST /api/v1/auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  if (!token) throw new ApiError(401, 'No refresh token provided.');

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token. Please log in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || user.refreshToken !== token) {
    throw new ApiError(401, 'Refresh token no longer valid. Please log in again.');
  }

  const { accessToken, refreshToken } = issueTokens(user);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

  res.cookie('accessToken', accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, cookieOpts);

  return success(res, 200, 'Token refreshed', { accessToken });
});

// POST /api/v1/auth/logout
const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await prisma.user.update({ where: { id: req.user.id }, data: { refreshToken: null } });
  }
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  return success(res, 200, 'Logged out successfully');
});

// GET /api/v1/auth/me
const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, name: true, email: true, phone: true, role: true,
      avatarUrl: true, createdAt: true,
      seller: { select: { id: true, storeName: true, status: true } },
    },
  });
  return success(res, 200, 'Current user fetched', { user });
});

module.exports = { register, login, refresh, logout, me };
