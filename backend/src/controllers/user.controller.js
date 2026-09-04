const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');

const SAFE_SELECT = {
  id: true, name: true, email: true, phone: true, role: true,
  avatarUrl: true, isActive: true, emailVerified: true, lastLoginAt: true, createdAt: true,
};

// GET /api/v1/users
const listUsers = asyncHandler(async (req, res) => {
  const { q, role, isActive } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['name', 'createdAt', 'lastLoginAt'] });

  const where = {
    ...(role && { role }),
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy, select: SAFE_SELECT }),
    prisma.user.count({ where }),
  ]);

  return success(res, 200, 'Users fetched', users, buildMeta({ page, limit }, total));
});

// GET /api/v1/users/:id
const getUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: SAFE_SELECT });
  if (!user) throw new ApiError(404, 'User not found.');
  return success(res, 200, 'User fetched', user);
});

// POST /api/v1/users  — admin creates internal staff accounts (Accountant, Stock Manager, etc.)
const createUser = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  const allowedRoles = ['SUPER_ADMIN', 'SELLER', 'ACCOUNTANT', 'STOCK_MANAGER', 'DELIVERY_AGENT', 'CUSTOMER'];

  if (!name || !email || !password) throw new ApiError(422, 'name, email and password are required.');
  if (role && !allowedRoles.includes(role)) throw new ApiError(422, 'Invalid role.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role: role || 'CUSTOMER', emailVerified: true },
    select: SAFE_SELECT,
  });

  return success(res, 201, 'User created', user);
});

// PATCH /api/v1/users/:id
const updateUser = asyncHandler(async (req, res) => {
  const allowedRoles = ['SUPER_ADMIN', 'SELLER', 'ACCOUNTANT', 'STOCK_MANAGER', 'DELIVERY_AGENT', 'CUSTOMER'];
  const data = {};
  for (const f of ['name', 'phone', 'isActive']) if (req.body[f] !== undefined) data[f] = req.body[f];

  if (req.body.role !== undefined) {
    if (!allowedRoles.includes(req.body.role)) throw new ApiError(422, 'Invalid role.');
    if (req.params.id === req.user.id && req.body.role !== req.user.role) {
      throw new ApiError(400, 'You cannot change your own role.');
    }
    data.role = req.body.role;
  }

  if (req.body.password) {
    data.passwordHash = await bcrypt.hash(req.body.password, 12);
  }

  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: SAFE_SELECT });
  return success(res, 200, 'User updated', user);
});

// PATCH /api/v1/users/:id/deactivate
const deactivateUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new ApiError(400, 'You cannot deactivate your own account.');
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false }, select: SAFE_SELECT });
  return success(res, 200, 'User deactivated', user);
});

// PATCH /api/v1/users/:id/activate
const activateUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: true }, select: SAFE_SELECT });
  return success(res, 200, 'User activated', user);
});

module.exports = { listUsers, getUser, createUser, updateUser, deactivateUser, activateUser };
