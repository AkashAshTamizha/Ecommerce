const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { applyStockMovement, transferStock } = require('../services/inventory.service');

// GET /api/v1/inventory  (list current stock levels, filterable)
const listInventory = asyncHandler(async (req, res) => {
  const { warehouseId, productId, lowStockOnly } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, {
    allowedSort: ['updatedAt', 'quantityOnHand'],
  });

  const where = {
    ...(warehouseId && { warehouseId }),
    ...(productId && { productId }),
  };

  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        product: { select: { id: true, name: true, sku: true, minStockLevel: true, maxStockLevel: true } },
        variant: { select: { id: true, sku: true, attributes: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.inventory.count({ where }),
  ]);

  let shaped = rows.map((r) => ({
    ...r,
    availableStock: r.quantityOnHand - r.quantityReserved,
    accountingAvailable: r.accountingOnHand - r.accountingReserved,
    isLowStock: r.quantityOnHand <= (r.product?.minStockLevel ?? r.reorderPoint),
  }));

  if (lowStockOnly === 'true') {
    shaped = shaped.filter((r) => r.isLowStock);
  }

  return success(res, 200, 'Inventory fetched', shaped, buildMeta({ page, limit }, total));
});

// GET /api/v1/inventory/low-stock  (dashboard alert widget)
const lowStockReport = asyncHandler(async (req, res) => {
  const inventories = await prisma.inventory.findMany({
    include: {
      product: { select: { id: true, name: true, sku: true, minStockLevel: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  const lowStock = inventories
    .filter((i) => i.quantityOnHand <= (i.product?.minStockLevel ?? i.reorderPoint))
    .sort((a, b) => a.quantityOnHand - b.quantityOnHand)
    .slice(0, 50);

  return success(res, 200, 'Low stock report generated', lowStock);
});

// GET /api/v1/inventory/movements  (audit ledger, paginated)
const listMovements = asyncHandler(async (req, res) => {
  const { productId, warehouseId, type } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['createdAt'] });

  const where = {
    ...(productId && { productId }),
    ...(warehouseId && { warehouseId }),
    ...(type && { type }),
  };

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        warehouse: { select: { name: true, code: true } },
        performedBy: { select: { name: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return success(res, 200, 'Stock movements fetched', rows, buildMeta({ page, limit }, total));
});

// POST /api/v1/inventory/stock-in
const stockIn = asyncHandler(async (req, res) => {
  const { productId, variantId, warehouseId, quantity, reference, reason } = req.body;
  if (!quantity || quantity <= 0) throw new ApiError(400, 'Quantity must be a positive number.');

  const result = await applyStockMovement({
    productId, variantId, warehouseId, quantity: Math.abs(quantity),
    type: 'STOCK_IN', reference, reason, performedById: req.user.id,
  });
  return success(res, 201, 'Stock added', result);
});

// POST /api/v1/inventory/stock-out
const stockOut = asyncHandler(async (req, res) => {
  const { productId, variantId, warehouseId, quantity, reference, reason } = req.body;
  if (!quantity || quantity <= 0) throw new ApiError(400, 'Quantity must be a positive number.');

  const result = await applyStockMovement({
    productId, variantId, warehouseId, quantity: -Math.abs(quantity),
    type: 'STOCK_OUT', reference, reason, performedById: req.user.id,
  });
  return success(res, 201, 'Stock removed', result);
});

// POST /api/v1/inventory/adjustment  (correct a count discrepancy — can be + or -)
const adjustment = asyncHandler(async (req, res) => {
  const { productId, variantId, warehouseId, quantity, reason } = req.body;
  if (!quantity) throw new ApiError(400, 'Quantity delta is required.');
  if (!reason) throw new ApiError(400, 'A reason is required for stock adjustments.');

  const result = await applyStockMovement({
    productId, variantId, warehouseId, quantity,
    type: 'ADJUSTMENT', reason, performedById: req.user.id,
  });
  return success(res, 201, 'Inventory adjusted', result);
});

// POST /api/v1/inventory/transfer  (warehouse to warehouse)
const transfer = asyncHandler(async (req, res) => {
  const { productId, variantId, fromWarehouseId, toWarehouseId, quantity, reference } = req.body;
  if (!quantity || quantity <= 0) throw new ApiError(400, 'Quantity must be a positive number.');

  const result = await transferStock({
    productId, variantId, fromWarehouseId, toWarehouseId, quantity,
    reference, performedById: req.user.id,
  });
  return success(res, 201, 'Stock transferred', result);
});

// PATCH /api/v1/inventory/:id/reorder-settings
const updateReorderSettings = asyncHandler(async (req, res) => {
  const { reorderPoint, reorderQty, binLocation } = req.body;
  const updated = await prisma.inventory.update({
    where: { id: req.params.id },
    data: { reorderPoint, reorderQty, binLocation },
  });
  return success(res, 200, 'Reorder settings updated', updated);
});

// PATCH /api/v1/inventory/:id/accounting-stock
// Directly corrects the book/ledger figures during a reconciliation —
// unlike physical stock, accounting stock isn't required to go through the
// movement ledger since it doesn't represent a physical warehouse event.
// body: { accountingOnHand?, accountingReserved? }
const updateAccountingStock = asyncHandler(async (req, res) => {
  const { accountingOnHand, accountingReserved } = req.body;
  if (accountingOnHand === undefined && accountingReserved === undefined) {
    throw new ApiError(422, 'Provide accountingOnHand and/or accountingReserved.');
  }
  if (accountingOnHand !== undefined && accountingOnHand < 0) throw new ApiError(422, 'accountingOnHand cannot be negative.');
  if (accountingReserved !== undefined && accountingReserved < 0) throw new ApiError(422, 'accountingReserved cannot be negative.');

  const existing = await prisma.inventory.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Inventory record not found.');

  const updated = await prisma.inventory.update({
    where: { id: req.params.id },
    data: {
      ...(accountingOnHand !== undefined && { accountingOnHand }),
      ...(accountingReserved !== undefined && { accountingReserved }),
    },
  });
  return success(res, 200, 'Accounting stock updated', updated);
});

module.exports = {
  listInventory, lowStockReport, listMovements,
  stockIn, stockOut, adjustment, transfer, updateReorderSettings, updateAccountingStock,
};
