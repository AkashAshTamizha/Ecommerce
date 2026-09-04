const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');

// GET /api/v1/sellers
const listSellers = asyncHandler(async (req, res) => {
  const { q, status } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['storeName', 'createdAt'] });

  const where = {
    ...(status && { status }),
    ...(q && {
      OR: [
        { storeName: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ],
    }),
  };

  const [sellers, total] = await Promise.all([
    prisma.seller.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
        _count: { select: { products: true, warehouses: true } },
      },
    }),
    prisma.seller.count({ where }),
  ]);

  return success(res, 200, 'Sellers fetched', sellers, buildMeta({ page, limit }, total));
});

// GET /api/v1/sellers/:id
const getSeller = asyncHandler(async (req, res) => {
  const seller = await prisma.seller.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
      documents: true,
      warehouses: { select: { id: true, name: true, code: true } },
      _count: { select: { products: true } },
    },
  });
  if (!seller) throw new ApiError(404, 'Seller not found.');
  return success(res, 200, 'Seller fetched', seller);
});

// PATCH /api/v1/sellers/:id/status   body: { status: 'APPROVED' | 'SUSPENDED' | 'REJECTED' }
const updateSellerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED'].includes(status)) {
    throw new ApiError(422, 'Invalid seller status.');
  }

  const seller = await prisma.seller.update({
    where: { id: req.params.id },
    data: { status },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await prisma.notification.create({
    data: {
      userId: seller.userId,
      title: `Seller account ${status.toLowerCase()}`,
      message: `Your seller account "${seller.storeName}" status changed to ${status}.`,
      type: status === 'APPROVED' ? 'SUCCESS' : status === 'REJECTED' || status === 'SUSPENDED' ? 'WARNING' : 'INFO',
    },
  }).catch(() => null);

  return success(res, 200, 'Seller status updated', seller);
});

// PATCH /api/v1/sellers/:id
const updateSeller = asyncHandler(async (req, res) => {
  const allowed = ['storeName', 'gstNumber', 'businessType', 'addressLine', 'city', 'state', 'country', 'pincode', 'commissionPct'];
  const data = {};
  for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f];

  const seller = await prisma.seller.update({ where: { id: req.params.id }, data });
  return success(res, 200, 'Seller updated', seller);
});

module.exports = { listSellers, getSeller, updateSellerStatus, updateSeller };
