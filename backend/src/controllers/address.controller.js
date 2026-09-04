const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');

// GET /api/v1/addresses
const listAddresses = asyncHandler(async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  return success(res, 200, 'Addresses fetched', addresses);
});

// POST /api/v1/addresses
const createAddress = asyncHandler(async (req, res) => {
  const { label, fullName, phone, addressLine, landmark, city, state, country, pincode, isDefault } = req.body;
  if (!fullName || !phone || !addressLine || !city || !state || !pincode) {
    throw new ApiError(422, 'fullName, phone, addressLine, city, state and pincode are required.');
  }

  if (isDefault) {
    await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
  }

  const count = await prisma.address.count({ where: { userId: req.user.id } });

  const address = await prisma.address.create({
    data: {
      userId: req.user.id, label: label || 'Home', fullName, phone, addressLine, landmark,
      city, state, country: country || 'India', pincode,
      isDefault: isDefault || count === 0, // first address is always the default
    },
  });
  return success(res, 201, 'Address created', address);
});

// PATCH /api/v1/addresses/:id
const updateAddress = asyncHandler(async (req, res) => {
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) throw new ApiError(404, 'Address not found.');

  if (req.body.isDefault) {
    await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
  }

  const allowed = ['label', 'fullName', 'phone', 'addressLine', 'landmark', 'city', 'state', 'country', 'pincode', 'isDefault'];
  const data = {};
  for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f];

  const address = await prisma.address.update({ where: { id: existing.id }, data });
  return success(res, 200, 'Address updated', address);
});

// DELETE /api/v1/addresses/:id
const deleteAddress = asyncHandler(async (req, res) => {
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) throw new ApiError(404, 'Address not found.');
  await prisma.address.delete({ where: { id: existing.id } });

  if (existing.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'asc' } });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  return success(res, 200, 'Address deleted');
});

module.exports = { listAddresses, createAddress, updateAddress, deleteAddress };
