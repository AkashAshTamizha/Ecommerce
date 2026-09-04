const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { applyStockMovement } = require('../services/inventory.service');

function genReturnNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `VR-${stamp}`;
}

const INCLUDE_DEFAULT = {
  vendor: { select: { id: true, name: true, email: true, phone: true } },
  warehouse: { select: { id: true, name: true, code: true } },
  purchaseOrder: { select: { id: true, poNumber: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true } }, variant: { select: { id: true, sku: true, attributes: true } } } },
  creditNotes: true,
};

// GET /api/v1/vendor-returns
const listVendorReturns = asyncHandler(async (req, res) => {
  const { vendorId, status, resolution, warehouseId, q } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['createdAt', 'totalValue'] });

  const where = {
    ...(vendorId && { vendorId }),
    ...(status && { status }),
    ...(resolution && { resolution }),
    ...(warehouseId && { warehouseId }),
    ...(q && { returnNumber: { contains: q, mode: 'insensitive' } }),
  };

  const [returns, total] = await Promise.all([
    prisma.vendorReturn.findMany({
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
    prisma.vendorReturn.count({ where }),
  ]);

  return success(res, 200, 'Vendor returns fetched', returns, buildMeta({ page, limit }, total));
});

// GET /api/v1/vendor-returns/:id
const getVendorReturn = asyncHandler(async (req, res) => {
  const ret = await prisma.vendorReturn.findUnique({ where: { id: req.params.id }, include: INCLUDE_DEFAULT });
  if (!ret) throw new ApiError(404, 'Vendor return not found.');
  return success(res, 200, 'Vendor return fetched', ret);
});

// POST /api/v1/vendor-returns
// body: { vendorId, warehouseId, purchaseOrderId?, reason, notes?, items: [{ productId, variantId?, quantity, unitCost, reason?, condition? }] }
// Created as DRAFT — no stock is moved yet, since the goods haven't physically
// left the warehouse until the return is actually sent to the vendor.
const createVendorReturn = asyncHandler(async (req, res) => {
  const { vendorId, warehouseId, purchaseOrderId, reason, notes, items } = req.body;

  if (!vendorId || !warehouseId) throw new ApiError(422, 'vendorId and warehouseId are required.');
  if (!reason) throw new ApiError(422, 'A reason for the return is required.');
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(422, 'At least one line item is required.');

  for (const it of items) {
    if (!it.productId) throw new ApiError(422, 'Every item requires a productId.');
    if (!it.quantity || Number(it.quantity) <= 0) throw new ApiError(422, 'Every item requires a positive quantity.');
    if (it.unitCost === undefined || it.unitCost === null) throw new ApiError(422, 'Every item requires a unitCost.');
  }

  const totalValue = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unitCost), 0);

  const ret = await prisma.vendorReturn.create({
    data: {
      returnNumber: genReturnNumber(),
      vendorId,
      warehouseId,
      purchaseOrderId: purchaseOrderId || null,
      reason,
      notes,
      totalValue,
      createdById: req.user?.id,
      items: {
        create: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || null,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost),
          totalCost: Number(it.quantity) * Number(it.unitCost),
          reason: it.reason || null,
          condition: it.condition || null,
        })),
      },
    },
    include: INCLUDE_DEFAULT,
  });

  return success(res, 201, 'Vendor return created', ret);
});

// PATCH /api/v1/vendor-returns/:id  (DRAFT only — notes/reason)
const updateVendorReturn = asyncHandler(async (req, res) => {
  const existing = await prisma.vendorReturn.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Vendor return not found.');
  if (existing.status !== 'DRAFT') throw new ApiError(409, 'Only draft returns can be edited. Cancel it instead.');

  const allowed = ['notes', 'reason', 'purchaseOrderId'];
  const data = {};
  for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f];

  const ret = await prisma.vendorReturn.update({ where: { id: req.params.id }, data, include: INCLUDE_DEFAULT });
  return success(res, 200, 'Vendor return updated', ret);
});

// PATCH /api/v1/vendor-returns/:id/send
// Marks the return as physically shipped to the vendor and removes the
// returned quantities from warehouse stock (DAMAGED stock movement, mirroring
// the existing STOCK_IN/STOCK_OUT ledger pattern used elsewhere).
const sendVendorReturn = asyncHandler(async (req, res) => {
  const ret = await prisma.vendorReturn.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!ret) throw new ApiError(404, 'Vendor return not found.');
  if (ret.status !== 'DRAFT') throw new ApiError(409, 'Only draft returns can be sent to the vendor.');

  for (const item of ret.items) {
    await applyStockMovement({
      productId: item.productId,
      variantId: item.variantId,
      warehouseId: ret.warehouseId,
      quantity: -item.quantity,
      type: 'DAMAGED',
      reference: ret.returnNumber,
      reason: `Vendor return sent — ${item.reason || ret.reason}`,
      performedById: req.user?.id,
    });
  }

  const updated = await prisma.vendorReturn.update({
    where: { id: ret.id },
    data: { status: 'SENT_TO_VENDOR', sentAt: new Date() },
    include: INCLUDE_DEFAULT,
  });

  return success(res, 200, 'Vendor return marked as sent', updated);
});

// PATCH /api/v1/vendor-returns/:id/acknowledge
const acknowledgeVendorReturn = asyncHandler(async (req, res) => {
  const ret = await prisma.vendorReturn.findUnique({ where: { id: req.params.id } });
  if (!ret) throw new ApiError(404, 'Vendor return not found.');
  if (ret.status !== 'SENT_TO_VENDOR') throw new ApiError(409, 'Only returns already sent to the vendor can be acknowledged.');

  const updated = await prisma.vendorReturn.update({
    where: { id: ret.id },
    data: { status: 'ACKNOWLEDGED' },
    include: INCLUDE_DEFAULT,
  });
  return success(res, 200, 'Vendor return acknowledged', updated);
});

// POST /api/v1/vendor-returns/:id/resolve
// body: { resolution: 'CREDIT_NOTE'|'REPLACEMENT'|'REFUND'|'REJECTED', creditNote?: { amount, expiryDate?, notes? } }
// This is where the vendor's actual response gets recorded:
//  - CREDIT_NOTE: creates a VendorCreditNote for later use against future POs.
//  - REPLACEMENT: vendor sends replacement stock back in — restocks the warehouse.
//  - REFUND / REJECTED: no stock or credit-note side effects, just closes the loop.
const resolveVendorReturn = asyncHandler(async (req, res) => {
  const ret = await prisma.vendorReturn.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!ret) throw new ApiError(404, 'Vendor return not found.');
  if (!['SENT_TO_VENDOR', 'ACKNOWLEDGED'].includes(ret.status)) {
    throw new ApiError(409, 'Only returns that have been sent to the vendor can be resolved.');
  }

  const { resolution, creditNote } = req.body;
  const validResolutions = ['CREDIT_NOTE', 'REPLACEMENT', 'REFUND', 'REJECTED'];
  if (!validResolutions.includes(resolution)) {
    throw new ApiError(422, `resolution must be one of: ${validResolutions.join(', ')}`);
  }

  if (resolution === 'CREDIT_NOTE') {
    if (!creditNote?.amount || Number(creditNote.amount) <= 0) {
      throw new ApiError(422, 'creditNote.amount is required and must be greater than zero.');
    }
    await prisma.vendorCreditNote.create({
      data: {
        creditNoteNumber: `CN-${Date.now().toString(36).toUpperCase()}`,
        vendorId: ret.vendorId,
        vendorReturnId: ret.id,
        amount: Number(creditNote.amount),
        expiryDate: creditNote.expiryDate ? new Date(creditNote.expiryDate) : null,
        notes: creditNote.notes,
        createdById: req.user?.id,
      },
    });
  }

  if (resolution === 'REPLACEMENT') {
    for (const item of ret.items) {
      await applyStockMovement({
        productId: item.productId,
        variantId: item.variantId,
        warehouseId: ret.warehouseId,
        quantity: item.quantity,
        type: 'STOCK_IN',
        reference: ret.returnNumber,
        reason: 'Replacement stock received from vendor',
        performedById: req.user?.id,
      });
    }
  }

  const updated = await prisma.vendorReturn.update({
    where: { id: ret.id },
    data: { resolution, status: 'RESOLVED', resolvedAt: new Date() },
    include: INCLUDE_DEFAULT,
  });

  return success(res, 200, 'Vendor return resolved', updated);
});

// PATCH /api/v1/vendor-returns/:id/cancel
// If stock had already left the warehouse (SENT_TO_VENDOR/ACKNOWLEDGED), it's
// restocked here — cancelling a return you already shipped means the goods
// are (presumably) still sitting with you, or the claim is being abandoned.
const cancelVendorReturn = asyncHandler(async (req, res) => {
  const ret = await prisma.vendorReturn.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!ret) throw new ApiError(404, 'Vendor return not found.');
  if (['RESOLVED', 'CANCELLED'].includes(ret.status)) {
    throw new ApiError(409, 'This return is already closed.');
  }

  if (['SENT_TO_VENDOR', 'ACKNOWLEDGED'].includes(ret.status)) {
    for (const item of ret.items) {
      await applyStockMovement({
        productId: item.productId,
        variantId: item.variantId,
        warehouseId: ret.warehouseId,
        quantity: item.quantity,
        type: 'RETURN_RESTOCK',
        reference: ret.returnNumber,
        reason: 'Vendor return cancelled — stock restored',
        performedById: req.user?.id,
      });
    }
  }

  const updated = await prisma.vendorReturn.update({
    where: { id: ret.id },
    data: { status: 'CANCELLED' },
    include: INCLUDE_DEFAULT,
  });
  return success(res, 200, 'Vendor return cancelled', updated);
});

// DELETE /api/v1/vendor-returns/:id  (only DRAFT)
const deleteVendorReturn = asyncHandler(async (req, res) => {
  const ret = await prisma.vendorReturn.findUnique({ where: { id: req.params.id } });
  if (!ret) throw new ApiError(404, 'Vendor return not found.');
  if (ret.status !== 'DRAFT') throw new ApiError(409, 'Only draft returns can be deleted. Cancel it instead.');
  await prisma.vendorReturn.delete({ where: { id: req.params.id } });
  return success(res, 200, 'Vendor return deleted');
});

module.exports = {
  listVendorReturns, getVendorReturn, createVendorReturn, updateVendorReturn,
  sendVendorReturn, acknowledgeVendorReturn, resolveVendorReturn, cancelVendorReturn, deleteVendorReturn,
};
