const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { applyStockMovement } = require('../services/inventory.service');
const { createNotification } = require('../services/notification.service');

const RETURN_WINDOW_DAYS = 7;

const REASONS = ['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'SIZE_FIT_ISSUE', 'NO_LONGER_NEEDED', 'QUALITY_ISSUE', 'OTHER'];
const REFUND_METHODS = ['ORIGINAL_PAYMENT_METHOD', 'STORE_CREDIT', 'BANK_TRANSFER'];

// Allowed next statuses, keyed by the request's own `type` — a RETURN and a
// REPLACEMENT share the same spine up to RECEIVED, then fork. Anything not
// listed for a status (other than the shared REJECTED/CANCELLED exits) is
// a dead end.
const NEXT_STATUS = {
  RETURN: {
    REQUESTED: ['APPROVED', 'REJECTED'],
    APPROVED: ['PICKUP_SCHEDULED', 'REJECTED'],
    PICKUP_SCHEDULED: ['PICKED_UP'],
    PICKED_UP: ['RECEIVED'],
    RECEIVED: ['REFUNDED'],
    REFUNDED: [],
    REJECTED: [],
    CANCELLED: [],
  },
  REPLACEMENT: {
    REQUESTED: ['APPROVED', 'REJECTED'],
    APPROVED: ['PICKUP_SCHEDULED', 'REJECTED'],
    PICKUP_SCHEDULED: ['PICKED_UP'],
    PICKED_UP: ['RECEIVED'],
    RECEIVED: ['REPLACEMENT_SHIPPED'],
    REPLACEMENT_SHIPPED: ['REPLACEMENT_DELIVERED'],
    REPLACEMENT_DELIVERED: [],
    REJECTED: [],
    CANCELLED: [],
  },
};

function genRequestNumber() {
  return `RR-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
}

function assertTransition(ret, nextStatus) {
  const allowed = NEXT_STATUS[ret.type][ret.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(409, `Cannot move a ${ret.type.toLowerCase()} request from ${ret.status} to ${nextStatus}.`);
  }
}

const INCLUDE_DEFAULT = {
  order: { select: { id: true, orderNumber: true, status: true, totalAmount: true, paymentMethod: true, paymentStatus: true } },
  customer: { select: { id: true, name: true, email: true, phone: true } },
  resolvedBy: { select: { id: true, name: true } },
  items: {
    include: {
      orderItem: {
        include: {
          product: { select: { id: true, name: true, sku: true, images: { where: { isPrimary: true, variantId: null }, take: 1 } } },
          variant: { select: { id: true, sku: true, attributes: true } },
        },
      },
    },
  },
};

// GET /api/v1/return-requests/mine  (customer — their own claims)
const listMyReturnRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['createdAt'] });
  const where = { customerId: req.user.id, ...(status && { status }) };

  const [requests, total] = await Promise.all([
    prisma.returnRequest.findMany({ where, skip, take, orderBy, include: INCLUDE_DEFAULT }),
    prisma.returnRequest.count({ where }),
  ]);

  return success(res, 200, 'Your return requests fetched', requests, buildMeta({ page, limit }, total));
});

// GET /api/v1/return-requests  (staff — every claim on the platform)
const listReturnRequests = asyncHandler(async (req, res) => {
  const { status, type, q } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['createdAt'] });

  const where = {
    ...(status && { status }),
    ...(type && { type }),
    ...(q && { requestNumber: { contains: q, mode: 'insensitive' } }),
  };

  const [requests, total] = await Promise.all([
    prisma.returnRequest.findMany({ where, skip, take, orderBy, include: INCLUDE_DEFAULT }),
    prisma.returnRequest.count({ where }),
  ]);

  return success(res, 200, 'Return requests fetched', requests, buildMeta({ page, limit }, total));
});

// GET /api/v1/return-requests/:id  (own claim for a customer, any for staff)
const getReturnRequest = asyncHandler(async (req, res) => {
  const ret = await prisma.returnRequest.findUnique({ where: { id: req.params.id }, include: INCLUDE_DEFAULT });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  if (req.user.role === 'CUSTOMER' && ret.customerId !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to view this return request.');
  }
  return success(res, 200, 'Return request fetched', ret);
});

// POST /api/v1/return-requests
// body: { orderId, type: 'RETURN'|'REPLACEMENT', reason, customerNotes?,
//         items: [{ orderItemId, quantity }] }
const createReturnRequest = asyncHandler(async (req, res) => {
  const { orderId, type, reason, customerNotes, items } = req.body;

  if (!orderId) throw new ApiError(422, 'orderId is required.');
  if (!['RETURN', 'REPLACEMENT'].includes(type)) throw new ApiError(422, 'type must be RETURN or REPLACEMENT.');
  if (!REASONS.includes(reason)) throw new ApiError(422, `reason must be one of: ${REASONS.join(', ')}`);
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(422, 'At least one item is required.');

  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId: req.user.id },
    include: { items: true, shipment: { select: { deliveredAt: true } } },
  });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.status !== 'DELIVERED') {
    throw new ApiError(400, 'Only delivered orders are eligible for a return or replacement.');
  }

  const deliveredAt = order.shipment?.deliveredAt || order.updatedAt;
  const daysSinceDelivery = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
    throw new ApiError(400, `The return window for this order closed ${Math.floor(daysSinceDelivery - RETURN_WINDOW_DAYS)} day(s) ago (${RETURN_WINDOW_DAYS}-day limit from delivery).`);
  }

  // Every unit of every line item can only ever be claimed once — sum up
  // what's already been requested (excluding claims that never went
  // anywhere, i.e. REJECTED/CANCELLED) and make sure this request doesn't
  // push any line past what was actually ordered.
  const existingItems = await prisma.returnRequestItem.findMany({
    where: {
      orderItemId: { in: items.map((i) => i.orderItemId) },
      returnRequest: { status: { notIn: ['REJECTED', 'CANCELLED'] } },
    },
  });
  const alreadyClaimed = {};
  for (const ei of existingItems) alreadyClaimed[ei.orderItemId] = (alreadyClaimed[ei.orderItemId] || 0) + ei.quantity;

  const lines = [];
  for (const reqItem of items) {
    if (!reqItem.orderItemId || !reqItem.quantity || Number(reqItem.quantity) <= 0) {
      throw new ApiError(422, 'Every item requires an orderItemId and a positive quantity.');
    }
    const orderItem = order.items.find((oi) => oi.id === reqItem.orderItemId);
    if (!orderItem) throw new ApiError(400, 'One of the items does not belong to this order.');

    const claimedSoFar = alreadyClaimed[orderItem.id] || 0;
    const remaining = orderItem.quantity - claimedSoFar;
    if (Number(reqItem.quantity) > remaining) {
      throw new ApiError(400, `Only ${remaining} unit(s) of this item are still eligible for a claim.`);
    }
    lines.push({ orderItemId: orderItem.id, quantity: Number(reqItem.quantity), unitPrice: orderItem.price });
  }

  const created = await prisma.returnRequest.create({
    data: {
      requestNumber: genRequestNumber(),
      orderId: order.id,
      customerId: req.user.id,
      type,
      reason,
      customerNotes,
      items: { create: lines },
    },
    include: INCLUDE_DEFAULT,
  });

  await createNotification({
    role: 'SUPER_ADMIN',
    title: `New ${type === 'RETURN' ? 'return' : 'replacement'} request`,
    message: `${created.requestNumber} was filed against order ${order.orderNumber}.`,
    type: 'INFO',
  });

  return success(res, 201, 'Return request submitted', created);
});

// PATCH /api/v1/return-requests/:id/cancel  (customer — only while REQUESTED)
const cancelMyReturnRequest = asyncHandler(async (req, res) => {
  const ret = await prisma.returnRequest.findFirst({ where: { id: req.params.id, customerId: req.user.id } });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  if (ret.status !== 'REQUESTED') {
    throw new ApiError(400, 'This request has already been actioned and can no longer be cancelled — please contact support.');
  }

  const updated = await prisma.returnRequest.update({ where: { id: ret.id }, data: { status: 'CANCELLED' }, include: INCLUDE_DEFAULT });
  return success(res, 200, 'Return request cancelled', updated);
});

// PATCH /api/v1/return-requests/:id/approve   body: { staffNotes? }
const approveReturnRequest = asyncHandler(async (req, res) => {
  const ret = await prisma.returnRequest.findUnique({ where: { id: req.params.id } });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  assertTransition(ret, 'APPROVED');

  const updated = await prisma.returnRequest.update({
    where: { id: ret.id },
    data: { status: 'APPROVED', staffNotes: req.body.staffNotes, resolvedById: req.user.id },
    include: INCLUDE_DEFAULT,
  });
  await createNotification({ userId: ret.customerId, title: 'Your request was approved', message: `${ret.requestNumber} has been approved. We'll arrange pickup shortly.`, type: 'SUCCESS' });
  return success(res, 200, 'Return request approved', updated);
});

// PATCH /api/v1/return-requests/:id/reject   body: { rejectionReason }
const rejectReturnRequest = asyncHandler(async (req, res) => {
  const { rejectionReason } = req.body;
  if (!rejectionReason) throw new ApiError(422, 'rejectionReason is required.');

  const ret = await prisma.returnRequest.findUnique({ where: { id: req.params.id } });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  assertTransition(ret, 'REJECTED');

  const updated = await prisma.returnRequest.update({
    where: { id: ret.id },
    data: { status: 'REJECTED', rejectionReason, resolvedById: req.user.id },
    include: INCLUDE_DEFAULT,
  });
  await createNotification({ userId: ret.customerId, title: 'Your request was rejected', message: `${ret.requestNumber} was rejected: ${rejectionReason}`, type: 'WARNING' });
  return success(res, 200, 'Return request rejected', updated);
});

// PATCH /api/v1/return-requests/:id/schedule-pickup   body: { pickupScheduledAt }
const schedulePickup = asyncHandler(async (req, res) => {
  const { pickupScheduledAt } = req.body;
  if (!pickupScheduledAt) throw new ApiError(422, 'pickupScheduledAt is required.');

  const ret = await prisma.returnRequest.findUnique({ where: { id: req.params.id } });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  assertTransition(ret, 'PICKUP_SCHEDULED');

  const updated = await prisma.returnRequest.update({
    where: { id: ret.id },
    data: { status: 'PICKUP_SCHEDULED', pickupScheduledAt: new Date(pickupScheduledAt) },
    include: INCLUDE_DEFAULT,
  });
  await createNotification({ userId: ret.customerId, title: 'Pickup scheduled', message: `Pickup for ${ret.requestNumber} is scheduled for ${new Date(pickupScheduledAt).toLocaleDateString()}.`, type: 'INFO' });
  return success(res, 200, 'Pickup scheduled', updated);
});

// PATCH /api/v1/return-requests/:id/mark-picked-up
const markPickedUp = asyncHandler(async (req, res) => {
  const ret = await prisma.returnRequest.findUnique({ where: { id: req.params.id } });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  assertTransition(ret, 'PICKED_UP');

  const updated = await prisma.returnRequest.update({
    where: { id: ret.id },
    data: { status: 'PICKED_UP', pickedUpAt: new Date() },
    include: INCLUDE_DEFAULT,
  });
  return success(res, 200, 'Marked as picked up', updated);
});

// PATCH /api/v1/return-requests/:id/mark-received
// The goods are physically back in the warehouse — restock every line now,
// same RETURN_RESTOCK movement type the staff-driven order return uses.
const markReceived = asyncHandler(async (req, res) => {
  const ret = await prisma.returnRequest.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { orderItem: true } } },
  });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  assertTransition(ret, 'RECEIVED');

  for (const item of ret.items) {
    if (!item.orderItem.warehouseId) continue;
    await applyStockMovement({
      productId: item.orderItem.productId,
      variantId: item.orderItem.variantId,
      warehouseId: item.orderItem.warehouseId,
      quantity: item.quantity,
      type: 'RETURN_RESTOCK',
      reference: ret.requestNumber,
      reason: `Customer ${ret.type.toLowerCase()} received — ${ret.reason}`,
      performedById: req.user.id,
    });
  }

  const updated = await prisma.returnRequest.update({
    where: { id: ret.id },
    data: { status: 'RECEIVED', receivedAt: new Date() },
    include: INCLUDE_DEFAULT,
  });
  return success(res, 200, 'Marked as received into warehouse', updated);
});

// PATCH /api/v1/return-requests/:id/refund   body: { refundAmount, refundMethod }
// RETURN-only. Marks the claim REFUNDED, and — if this closes out every unit
// of the order — flips the order itself to paymentStatus REFUNDED / status
// RETURNED, mirroring what staff-driven order returns already do.
const refundReturnRequest = asyncHandler(async (req, res) => {
  const { refundAmount, refundMethod } = req.body;
  if (!refundAmount || Number(refundAmount) <= 0) throw new ApiError(422, 'refundAmount is required and must be greater than zero.');
  if (!REFUND_METHODS.includes(refundMethod)) throw new ApiError(422, `refundMethod must be one of: ${REFUND_METHODS.join(', ')}`);

  const ret = await prisma.returnRequest.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  if (ret.type !== 'RETURN') throw new ApiError(400, 'Only RETURN requests can be refunded — use the replacement actions for a REPLACEMENT request.');
  assertTransition(ret, 'REFUNDED');

  const updated = await prisma.returnRequest.update({
    where: { id: ret.id },
    data: { status: 'REFUNDED', refundAmount: Number(refundAmount), refundMethod, refundedAt: new Date() },
    include: INCLUDE_DEFAULT,
  });

  // Has every unit of this order now been refunded? If so the order itself
  // is fully settled — otherwise leave the order's own status/paymentStatus
  // alone, since other line items may still be in flight or kept.
  const order = await prisma.order.findUnique({ where: { id: ret.orderId }, include: { items: true } });
  const refundedItems = await prisma.returnRequestItem.findMany({
    where: { returnRequest: { orderId: ret.orderId, type: 'RETURN', status: 'REFUNDED' } },
  });
  const refundedQtyByItem = {};
  for (const ri of refundedItems) refundedQtyByItem[ri.orderItemId] = (refundedQtyByItem[ri.orderItemId] || 0) + ri.quantity;
  const fullyRefunded = order.items.every((oi) => (refundedQtyByItem[oi.id] || 0) >= oi.quantity);

  if (fullyRefunded && order.status === 'DELIVERED') {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'REFUNDED', status: 'RETURNED' } });
  }

  await createNotification({ userId: ret.customerId, title: 'Refund processed', message: `A refund of ${refundAmount} for ${ret.requestNumber} has been issued via ${refundMethod.replace(/_/g, ' ').toLowerCase()}.`, type: 'SUCCESS' });
  return success(res, 200, 'Refund recorded', updated);
});

// PATCH /api/v1/return-requests/:id/ship-replacement   body: { courierName?, trackingNumber? }
// REPLACEMENT-only. Deducts fresh stock for the replacement unit(s) — a real
// physical removal, so this fails with a clear error if there isn't enough
// stock on hand, same as any other STOCK_OUT movement.
const shipReplacement = asyncHandler(async (req, res) => {
  const { courierName, trackingNumber } = req.body;

  const ret = await prisma.returnRequest.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { orderItem: true } } },
  });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  if (ret.type !== 'REPLACEMENT') throw new ApiError(400, 'Only REPLACEMENT requests can be shipped — use the refund action for a RETURN request.');
  assertTransition(ret, 'REPLACEMENT_SHIPPED');

  for (const item of ret.items) {
    if (!item.orderItem.warehouseId) continue;
    await applyStockMovement({
      productId: item.orderItem.productId,
      variantId: item.orderItem.variantId,
      warehouseId: item.orderItem.warehouseId,
      quantity: -item.quantity,
      type: 'STOCK_OUT',
      reference: ret.requestNumber,
      reason: 'Replacement unit shipped to customer',
      performedById: req.user.id,
    });
  }

  const updated = await prisma.returnRequest.update({
    where: { id: ret.id },
    data: { status: 'REPLACEMENT_SHIPPED', replacementCourierName: courierName, replacementTrackingNumber: trackingNumber, replacementShippedAt: new Date() },
    include: INCLUDE_DEFAULT,
  });
  await createNotification({ userId: ret.customerId, title: 'Replacement shipped', message: `Your replacement for ${ret.requestNumber} is on its way${trackingNumber ? ` (tracking #${trackingNumber})` : ''}.`, type: 'SUCCESS' });
  return success(res, 200, 'Replacement marked as shipped', updated);
});

// PATCH /api/v1/return-requests/:id/deliver-replacement
const deliverReplacement = asyncHandler(async (req, res) => {
  const ret = await prisma.returnRequest.findUnique({ where: { id: req.params.id } });
  if (!ret) throw new ApiError(404, 'Return request not found.');
  if (ret.type !== 'REPLACEMENT') throw new ApiError(400, 'Only REPLACEMENT requests reach this step.');
  assertTransition(ret, 'REPLACEMENT_DELIVERED');

  const updated = await prisma.returnRequest.update({
    where: { id: ret.id },
    data: { status: 'REPLACEMENT_DELIVERED', replacementDeliveredAt: new Date() },
    include: INCLUDE_DEFAULT,
  });
  await createNotification({ userId: ret.customerId, title: 'Replacement delivered', message: `Your replacement for ${ret.requestNumber} has been delivered.`, type: 'SUCCESS' });
  return success(res, 200, 'Replacement marked as delivered', updated);
});

module.exports = {
  listMyReturnRequests, listReturnRequests, getReturnRequest, createReturnRequest, cancelMyReturnRequest,
  approveReturnRequest, rejectReturnRequest, schedulePickup, markPickedUp, markReceived,
  refundReturnRequest, shipReplacement, deliverReplacement,
};
