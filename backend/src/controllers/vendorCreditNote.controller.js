const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');

const INCLUDE_DEFAULT = {
  vendor: { select: { id: true, name: true, email: true } },
  vendorReturn: { select: { id: true, returnNumber: true, reason: true } },
  createdBy: { select: { id: true, name: true } },
  applications: {
    include: { purchaseOrder: { select: { id: true, poNumber: true } }, appliedBy: { select: { id: true, name: true } } },
    orderBy: { appliedAt: 'desc' },
  },
};

// GET /api/v1/vendor-credit-notes
const listVendorCreditNotes = asyncHandler(async (req, res) => {
  const { vendorId, status, q } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['createdAt', 'amount', 'issuedDate'] });

  const where = {
    ...(vendorId && { vendorId }),
    ...(status && { status }),
    ...(q && { creditNoteNumber: { contains: q, mode: 'insensitive' } }),
  };

  const [notes, total] = await Promise.all([
    prisma.vendorCreditNote.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        vendor: { select: { id: true, name: true } },
        vendorReturn: { select: { id: true, returnNumber: true } },
      },
    }),
    prisma.vendorCreditNote.count({ where }),
  ]);

  return success(res, 200, 'Vendor credit notes fetched', notes, buildMeta({ page, limit }, total));
});

// GET /api/v1/vendor-credit-notes/:id
const getVendorCreditNote = asyncHandler(async (req, res) => {
  const note = await prisma.vendorCreditNote.findUnique({ where: { id: req.params.id }, include: INCLUDE_DEFAULT });
  if (!note) throw new ApiError(404, 'Vendor credit note not found.');
  return success(res, 200, 'Vendor credit note fetched', note);
});

// POST /api/v1/vendor-credit-notes
// Standalone creation — most credit notes come out of resolving a Vendor
// Return, but a vendor can also issue one directly (goodwill credit,
// pricing dispute, etc), so this stays available on its own.
// body: { vendorId, amount, vendorReturnId?, expiryDate?, notes? }
const createVendorCreditNote = asyncHandler(async (req, res) => {
  const { vendorId, amount, vendorReturnId, expiryDate, notes } = req.body;
  if (!vendorId) throw new ApiError(422, 'vendorId is required.');
  if (!amount || Number(amount) <= 0) throw new ApiError(422, 'amount is required and must be greater than zero.');

  const note = await prisma.vendorCreditNote.create({
    data: {
      creditNoteNumber: `CN-${Date.now().toString(36).toUpperCase()}`,
      vendorId,
      vendorReturnId: vendorReturnId || null,
      amount: Number(amount),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      notes,
      createdById: req.user?.id,
    },
    include: INCLUDE_DEFAULT,
  });

  return success(res, 201, 'Vendor credit note created', note);
});

// POST /api/v1/vendor-credit-notes/:id/apply
// Draws the credit note down against a specific purchase order.
// body: { purchaseOrderId, amount }
const applyVendorCreditNote = asyncHandler(async (req, res) => {
  const note = await prisma.vendorCreditNote.findUnique({ where: { id: req.params.id } });
  if (!note) throw new ApiError(404, 'Vendor credit note not found.');
  if (note.status === 'CANCELLED') throw new ApiError(409, 'This credit note has been cancelled.');

  const { purchaseOrderId, amount } = req.body;
  if (!purchaseOrderId) throw new ApiError(422, 'purchaseOrderId is required.');
  const applyAmount = Number(amount);
  if (!applyAmount || applyAmount <= 0) throw new ApiError(422, 'amount must be greater than zero.');

  const remaining = Number(note.amount) - Number(note.appliedAmount);
  if (applyAmount > remaining) {
    throw new ApiError(400, `Cannot apply ${applyAmount} — only ${remaining} remains on this credit note.`);
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
  if (!po) throw new ApiError(404, 'Purchase order not found.');
  if (po.vendorId !== note.vendorId) {
    throw new ApiError(400, 'This purchase order belongs to a different vendor than the credit note.');
  }

  await prisma.vendorCreditNoteApplication.create({
    data: { creditNoteId: note.id, purchaseOrderId, amountApplied: applyAmount, appliedById: req.user?.id },
  });

  const newApplied = Number(note.appliedAmount) + applyAmount;
  const updated = await prisma.vendorCreditNote.update({
    where: { id: note.id },
    data: {
      appliedAmount: newApplied,
      status: newApplied >= Number(note.amount) ? 'APPLIED' : 'PARTIALLY_APPLIED',
    },
    include: INCLUDE_DEFAULT,
  });

  return success(res, 200, 'Credit note applied to purchase order', updated);
});

// PATCH /api/v1/vendor-credit-notes/:id/cancel
const cancelVendorCreditNote = asyncHandler(async (req, res) => {
  const note = await prisma.vendorCreditNote.findUnique({ where: { id: req.params.id } });
  if (!note) throw new ApiError(404, 'Vendor credit note not found.');
  if (Number(note.appliedAmount) > 0) {
    throw new ApiError(409, 'Cannot cancel a credit note that has already been partially or fully applied.');
  }

  const updated = await prisma.vendorCreditNote.update({
    where: { id: note.id },
    data: { status: 'CANCELLED' },
    include: INCLUDE_DEFAULT,
  });
  return success(res, 200, 'Vendor credit note cancelled', updated);
});

module.exports = {
  listVendorCreditNotes, getVendorCreditNote, createVendorCreditNote, applyVendorCreditNote, cancelVendorCreditNote,
};
