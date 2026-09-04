const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');

// GET /api/v1/warehouses
const listWarehouses = asyncHandler(async (req, res) => {
  const { q, isActive } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['name', 'createdAt'] });

  const where = {
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
    ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] }),
  };

  const [warehouses, total] = await Promise.all([
    prisma.warehouse.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        _count: { select: { inventories: true, staff: true } },
      },
    }),
    prisma.warehouse.count({ where }),
  ]);

  return success(res, 200, 'Warehouses fetched', warehouses, buildMeta({ page, limit }, total));
});

// GET /api/v1/warehouses/:id
const getWarehouse = asyncHandler(async (req, res) => {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: req.params.id },
    include: {
      staff: { select: { id: true, name: true, email: true } },
      inventories: {
        include: { product: { select: { name: true, sku: true } } },
        take: 20,
      },
    },
  });
  if (!warehouse) throw new ApiError(404, 'Warehouse not found.');
  return success(res, 200, 'Warehouse fetched', warehouse);
});

// POST /api/v1/warehouses
const createWarehouse = asyncHandler(async (req, res) => {
  const { name, code, addressLine, city, state, country, pincode, sellerId } = req.body;
  const warehouse = await prisma.warehouse.create({
    data: { name, code, addressLine, city, state, country, pincode, sellerId },
  });
  return success(res, 201, 'Warehouse created', warehouse);
});

// PATCH /api/v1/warehouses/:id
const updateWarehouse = asyncHandler(async (req, res) => {
  const allowed = ['name', 'addressLine', 'city', 'state', 'country', 'pincode', 'isActive'];
  const data = {};
  for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f];

  const warehouse = await prisma.warehouse.update({ where: { id: req.params.id }, data });
  return success(res, 200, 'Warehouse updated', warehouse);
});

// DELETE /api/v1/warehouses/:id
const deleteWarehouse = asyncHandler(async (req, res) => {
  const stock = await prisma.inventory.aggregate({
    where: { warehouseId: req.params.id },
    _sum: { quantityOnHand: true },
  });
  if ((stock._sum.quantityOnHand || 0) > 0) {
    throw new ApiError(409, 'Cannot delete a warehouse that still holds stock. Transfer stock out first.');
  }
  await prisma.warehouse.delete({ where: { id: req.params.id } });
  return success(res, 200, 'Warehouse deleted');
});

// POST /api/v1/warehouses/:id/staff  { userId }
const assignStaff = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const warehouse = await prisma.warehouse.update({
    where: { id: req.params.id },
    data: { staff: { connect: { id: userId } } },
    include: { staff: { select: { id: true, name: true, email: true } } },
  });
  return success(res, 200, 'Staff assigned', warehouse);
});

// DELETE /api/v1/warehouses/:id/staff/:userId
const removeStaff = asyncHandler(async (req, res) => {
  const warehouse = await prisma.warehouse.update({
    where: { id: req.params.id },
    data: { staff: { disconnect: { id: req.params.userId } } },
  });
  return success(res, 200, 'Staff removed', warehouse);
});

module.exports = {
  listWarehouses, getWarehouse, createWarehouse, updateWarehouse, deleteWarehouse,
  assignStaff, removeStaff,
};
