const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');

// GET /api/v1/vendors
const listVendors = asyncHandler(async (req, res) => {
  const { q, isActive } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['name', 'createdAt'] });

  const where = {
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { _count: { select: { purchaseOrders: true } } },
    }),
    prisma.vendor.count({ where }),
  ]);

  return success(res, 200, 'Vendors fetched', vendors, buildMeta({ page, limit }, total));
});

// GET /api/v1/vendors/:id
const getVendor = asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: req.params.id },
    include: { purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!vendor) throw new ApiError(404, 'Vendor not found.');
  return success(res, 200, 'Vendor fetched', vendor);
});

// POST /api/v1/vendors
const createVendor = asyncHandler(async (req, res) => {
  const { name, contactPerson, email, phone, addressLine, city, state, country, pincode, gstNumber } = req.body;
  if (!name) throw new ApiError(422, 'Vendor name is required.');

  const vendor = await prisma.vendor.create({
    data: { name, contactPerson, email, phone, addressLine, city, state, country, pincode, gstNumber },
  });
  return success(res, 201, 'Vendor created', vendor);
});

// PATCH /api/v1/vendors/:id
const updateVendor = asyncHandler(async (req, res) => {
  const allowed = [
    'name', 'contactPerson', 'email', 'phone', 'addressLine',
    'city', 'state', 'country', 'pincode', 'gstNumber', 'isActive',
  ];
  const data = {};
  for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f];

  const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data });
  return success(res, 200, 'Vendor updated', vendor);
});

// DELETE /api/v1/vendors/:id
const deleteVendor = asyncHandler(async (req, res) => {
  const poCount = await prisma.purchaseOrder.count({ where: { vendorId: req.params.id } });
  if (poCount > 0) {
    // Vendor has history — deactivate instead of hard delete
    const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data: { isActive: false } });
    return success(res, 200, 'Vendor has purchase history, so it was deactivated instead of deleted', vendor);
  }
  await prisma.vendor.delete({ where: { id: req.params.id } });
  return success(res, 200, 'Vendor deleted');
});

module.exports = { listVendors, getVendor, createVendor, updateVendor, deleteVendor };
