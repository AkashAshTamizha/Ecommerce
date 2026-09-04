const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { createNotification } = require('../services/notification.service');

// Valid forward transitions for a shipment's lifecycle. Terminal states have none.
const NEXT_STATUS = {
  CREATED: ['PACKED', 'CANCELLED'],
  PACKED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY'],
  FAILED_DELIVERY: ['OUT_FOR_DELIVERY', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  RETURNED: [],
  CANCELLED: [],
};

// A Shipment's status keeps the parent Order's status roughly in sync so
// admins/customers see one consistent picture without following two models.
const ORDER_STATUS_FOR_SHIPMENT = {
  CREATED: 'CONFIRMED',
  PACKED: 'PACKED',
  PICKED_UP: 'SHIPPED',
  IN_TRANSIT: 'SHIPPED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
  // FAILED_DELIVERY intentionally does not move the order status — the order
  // stays OUT_FOR_DELIVERY while the shipment records the failed attempt.
};

function generateShipmentNumber() {
  return `SHP-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
}

const SHIPMENT_INCLUDE = {
  order: {
    select: {
      id: true, orderNumber: true, status: true, totalAmount: true, customerId: true,
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  },
  warehouse: { select: { id: true, name: true, code: true, city: true } },
  deliveryAgent: { select: { id: true, name: true, email: true, phone: true } },
  events: { orderBy: { createdAt: 'asc' } },
};

// Restricts delivery agents to only see shipments assigned to them; everyone
// else (admin/seller/stock manager) can see all shipments in scope.
function scopeForRole(req) {
  if (req.user.role === 'DELIVERY_AGENT') return { deliveryAgentId: req.user.id };
  return {};
}

// GET /api/v1/shipments
const listShipments = asyncHandler(async (req, res) => {
  const { status, warehouseId, q, deliveryAgentId } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, {
    allowedSort: ['createdAt', 'status', 'estimatedDeliveryDate'],
  });

  const where = {
    ...scopeForRole(req),
    ...(status && { status }),
    ...(warehouseId && { warehouseId }),
    ...(deliveryAgentId && { deliveryAgentId }),
    ...(q && {
      OR: [
        { shipmentNumber: { contains: q, mode: 'insensitive' } },
        { trackingNumber: { contains: q, mode: 'insensitive' } },
        { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
      ],
    }),
  };

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        deliveryAgent: { select: { id: true, name: true, phone: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.shipment.count({ where }),
  ]);

  return success(res, 200, 'Shipments fetched', shipments, buildMeta({ page, limit }, total));
});

// GET /api/v1/shipments/stats — quick counts for the dashboard widget
const shipmentStats = asyncHandler(async (req, res) => {
  const where = scopeForRole(req);
  const grouped = await prisma.shipment.groupBy({ by: ['status'], where, _count: { _all: true } });
  const stats = grouped.reduce((acc, g) => ({ ...acc, [g.status]: g._count._all }), {});
  return success(res, 200, 'Shipment stats fetched', stats);
});

// GET /api/v1/shipments/:id
const getShipment = asyncHandler(async (req, res) => {
  const shipment = await prisma.shipment.findFirst({
    where: { id: req.params.id, ...scopeForRole(req) },
    include: SHIPMENT_INCLUDE,
  });
  if (!shipment) throw new ApiError(404, 'Shipment not found.');
  return success(res, 200, 'Shipment fetched', shipment);
});

// POST /api/v1/shipments   — create a package/shipment for a confirmed order
// body: { orderId, warehouseId, courierName?, courierPhone?, trackingNumber?,
//         packageWeightKg?, packageLengthCm?, packageWidthCm?, packageHeightCm?,
//         estimatedDeliveryDate?, notes? }
const createShipment = asyncHandler(async (req, res) => {
  const {
    orderId, warehouseId, courierName, courierPhone, trackingNumber,
    packageWeightKg, packageLengthCm, packageWidthCm, packageHeightCm,
    estimatedDeliveryDate, notes,
  } = req.body;

  if (!orderId || !warehouseId) throw new ApiError(422, 'orderId and warehouseId are required.');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (['CANCELLED', 'RETURNED'].includes(order.status)) {
    throw new ApiError(400, `Cannot create a shipment for a ${order.status.toLowerCase()} order.`);
  }

  const existing = await prisma.shipment.findUnique({ where: { orderId } });
  if (existing) throw new ApiError(409, 'A shipment already exists for this order.');

  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new ApiError(404, 'Warehouse not found.');

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        shipmentNumber: generateShipmentNumber(),
        orderId,
        warehouseId,
        courierName, courierPhone, trackingNumber,
        packageWeightKg, packageLengthCm, packageWidthCm, packageHeightCm,
        estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
        notes,
        shippingAddress: order.shippingAddress,
        status: 'CREATED',
      },
      include: SHIPMENT_INCLUDE,
    });

    await tx.shipmentEvent.create({
      data: { shipmentId: created.id, status: 'CREATED', note: 'Package created and awaiting packing.' },
    });

    if (order.status === 'PENDING') {
      await tx.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
    }

    return created;
  });

  await createNotification({
    userId: order.customerId,
    title: 'Shipment created',
    message: `A shipment (${shipment.shipmentNumber}) has been created for order ${order.orderNumber}.`,
    type: 'INFO',
  });

  return success(res, 201, 'Shipment created', shipment);
});

// PATCH /api/v1/shipments/:id/status   body: { status, note?, location? }
const updateShipmentStatus = asyncHandler(async (req, res) => {
  const { status, note, location } = req.body;
  const shipment = await prisma.shipment.findFirst({ where: { id: req.params.id, ...scopeForRole(req) } });
  if (!shipment) throw new ApiError(404, 'Shipment not found.');

  const allowedNext = NEXT_STATUS[shipment.status] || [];
  if (!allowedNext.includes(status)) {
    throw new ApiError(400, `Cannot move shipment from ${shipment.status} to ${status}.`);
  }
  if (status === 'FAILED_DELIVERY' && !note) {
    throw new ApiError(422, 'A note explaining the failed delivery attempt is required.');
  }

  const timestamps = {};
  if (status === 'PICKED_UP') timestamps.pickedUpAt = new Date();
  if (status === 'DELIVERED') timestamps.deliveredAt = new Date();
  if (status === 'FAILED_DELIVERY') timestamps.failureReason = note;

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.shipment.update({
      where: { id: shipment.id },
      data: { status, ...timestamps },
      include: SHIPMENT_INCLUDE,
    });

    await tx.shipmentEvent.create({ data: { shipmentId: shipment.id, status, note, location } });

    const orderStatus = ORDER_STATUS_FOR_SHIPMENT[status];
    if (orderStatus) {
      await tx.order.update({ where: { id: shipment.orderId }, data: { status: orderStatus } });
    }

    return s;
  });

  await createNotification({
    userId: updated.order.customerId,
    title: 'Order shipment update',
    message: `Order ${updated.order.orderNumber} is now "${status.replace(/_/g, ' ').toLowerCase()}".`,
    type: status === 'FAILED_DELIVERY' ? 'WARNING' : 'INFO',
  });

  return success(res, 200, 'Shipment status updated', updated);
});

// PATCH /api/v1/shipments/:id/assign   body: { deliveryAgentId }
const assignDeliveryAgent = asyncHandler(async (req, res) => {
  const { deliveryAgentId } = req.body;
  if (!deliveryAgentId) throw new ApiError(422, 'deliveryAgentId is required.');

  const agent = await prisma.user.findUnique({ where: { id: deliveryAgentId } });
  if (!agent || agent.role !== 'DELIVERY_AGENT') {
    throw new ApiError(422, 'deliveryAgentId must reference an active Delivery Agent user.');
  }

  const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
  if (!shipment) throw new ApiError(404, 'Shipment not found.');

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.shipment.update({
      where: { id: shipment.id },
      data: { deliveryAgentId },
      include: SHIPMENT_INCLUDE,
    });
    await tx.shipmentEvent.create({
      data: { shipmentId: shipment.id, status: shipment.status, note: `Assigned to delivery agent ${agent.name}.` },
    });
    return s;
  });

  await createNotification({
    userId: deliveryAgentId,
    title: 'New delivery assigned',
    message: `You've been assigned shipment ${updated.shipmentNumber} for order ${updated.order.orderNumber}.`,
    type: 'INFO',
  });

  return success(res, 200, 'Delivery agent assigned', updated);
});

// PATCH /api/v1/shipments/:id/courier   body: { courierName?, courierPhone?, trackingNumber? }
const updateCourierInfo = asyncHandler(async (req, res) => {
  const allowed = ['courierName', 'courierPhone', 'trackingNumber', 'estimatedDeliveryDate', 'notes'];
  const data = {};
  for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f];
  if (data.estimatedDeliveryDate) data.estimatedDeliveryDate = new Date(data.estimatedDeliveryDate);

  const shipment = await prisma.shipment.update({
    where: { id: req.params.id },
    data,
    include: SHIPMENT_INCLUDE,
  });
  return success(res, 200, 'Courier details updated', shipment);
});

// GET /api/v1/shipments/agents/available — Delivery Agent users for the assignment dropdown
const listDeliveryAgents = asyncHandler(async (req, res) => {
  const agents = await prisma.user.findMany({
    where: { role: 'DELIVERY_AGENT', isActive: true },
    select: {
      id: true, name: true, email: true, phone: true,
      _count: { select: { shipmentsAssigned: true } },
    },
    orderBy: { name: 'asc' },
  });
  return success(res, 200, 'Delivery agents fetched', agents);
});

module.exports = {
  listShipments, shipmentStats, getShipment, createShipment,
  updateShipmentStatus, assignDeliveryAgent, updateCourierInfo, listDeliveryAgents,
};
