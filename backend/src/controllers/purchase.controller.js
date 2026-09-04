const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { applyStockMovement } = require('../services/inventory.service');

function genPoNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `PO-${stamp}`;
}

// GET /api/v1/purchases
const listPurchaseOrders = asyncHandler(async (req, res) => {
  const { status, vendorId, warehouseId, q } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['createdAt', 'totalAmount'] });

  const where = {
    ...(status && { status }),
    ...(vendorId && { vendorId }),
    ...(warehouseId && { warehouseId }),
    ...(q && { poNumber: { contains: q, mode: 'insensitive' } }),
  };

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        vendor: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return success(res, 200, 'Purchase orders fetched', orders, buildMeta({ page, limit }, total));
});

// GET /api/v1/purchases/:id
const getPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: {
      vendor: true,
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  });
  if (!po) throw new ApiError(404, 'Purchase order not found.');
  return success(res, 200, 'Purchase order fetched', po);
});

// POST /api/v1/purchases
// body: { vendorId, warehouseId, expectedDate, notes, items: [{ productId, quantityOrdered, unitCost }] }
const createPurchaseOrder = asyncHandler(async (req, res) => {
  const { vendorId, warehouseId, expectedDate, notes, items } = req.body;

  if (!vendorId || !warehouseId) throw new ApiError(422, 'vendorId and warehouseId are required.');
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(422, 'At least one line item is required.');

  const subtotal = items.reduce((sum, it) => sum + Number(it.quantityOrdered) * Number(it.unitCost), 0);

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: genPoNumber(),
      vendorId,
      warehouseId,
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      notes,
      subtotal,
      totalAmount: subtotal,
      createdById: req.user?.id,
      items: {
        create: items.map((it) => ({
          productId: it.productId,
          quantityOrdered: Number(it.quantityOrdered),
          unitCost: Number(it.unitCost),
        })),
      },
    },
    include: { items: true, vendor: true, warehouse: true },
  });

  return success(res, 201, 'Purchase order created', po);
});

// PATCH /api/v1/purchases/:id
const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const existing = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Purchase order not found.');
  if (['RECEIVED', 'CANCELLED'].includes(existing.status)) {
    throw new ApiError(409, 'This purchase order is already closed and cannot be edited.');
  }

  const allowed = ['expectedDate', 'notes'];
  const data = {};
  for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f];

  if (req.body.status && ['DRAFT', 'ORDERED', 'CANCELLED'].includes(req.body.status)) {
    data.status = req.body.status;
  }

  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data });
  return success(res, 200, 'Purchase order updated', po);
});

// POST /api/v1/purchases/:id/receive
// body: { items: [{ purchaseOrderItemId, quantity }] }  -- receives stock into inventory
const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!po) throw new ApiError(404, 'Purchase order not found.');
  if (po.status === 'CANCELLED') throw new ApiError(409, 'Cannot receive stock against a cancelled purchase order.');

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(422, 'At least one item to receive is required.');

  for (const receipt of items) {
    const line = po.items.find((it) => it.id === receipt.purchaseOrderItemId);
    if (!line) throw new ApiError(404, `Purchase order item ${receipt.purchaseOrderItemId} not found on this PO.`);

    const qty = Number(receipt.quantity);
    if (!qty || qty <= 0) continue;
    if (line.quantityReceived + qty > line.quantityOrdered) {
      throw new ApiError(400, `Cannot receive more than ordered for product ${line.productId}.`);
    }

    await applyStockMovement({
      productId: line.productId,
      variantId: null,
      warehouseId: po.warehouseId,
      quantity: qty,
      type: 'STOCK_IN',
      reference: po.poNumber,
      reason: 'Purchase order receipt',
      performedById: req.user?.id,
    });

    await prisma.purchaseOrderItem.update({
      where: { id: line.id },
      data: { quantityReceived: line.quantityReceived + qty },
    });
  }

  const refreshed = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include: { items: true } });
  const fullyReceived = refreshed.items.every((it) => it.quantityReceived >= it.quantityOrdered);
  const partiallyReceived = refreshed.items.some((it) => it.quantityReceived > 0);

  const updated = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { status: fullyReceived ? 'RECEIVED' : partiallyReceived ? 'PARTIALLY_RECEIVED' : po.status },
    include: { items: true, vendor: true, warehouse: true },
  });

  return success(res, 200, 'Stock received', updated);
});

// PATCH /api/v1/purchases/:id/mark-ordered
const markOrdered = asyncHandler(async (req, res) => {
  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { status: 'ORDERED' } });
  return success(res, 200, 'Purchase order marked as ordered', po);
});

// DELETE /api/v1/purchases/:id  (only DRAFT can be deleted)
const deletePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
  if (!po) throw new ApiError(404, 'Purchase order not found.');
  if (po.status !== 'DRAFT') throw new ApiError(409, 'Only draft purchase orders can be deleted. Cancel it instead.');
  await prisma.purchaseOrder.delete({ where: { id: req.params.id } });
  return success(res, 200, 'Purchase order deleted');
});

module.exports = {
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder,
  receivePurchaseOrder, markOrdered, deletePurchaseOrder,
};
