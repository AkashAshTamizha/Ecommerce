const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { reserveStock, releaseReservation, fulfillReservation, applyStockMovement } = require('../services/inventory.service');
const { createNotification } = require('../services/notification.service');
const { resolveBestOffer } = require('../services/offer.service');

const NEXT_STATUS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const SHIPPING_FEE = 49;
const FREE_SHIPPING_THRESHOLD = 999;

function generateOrderNumber() {
  return `ORD-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
}

// GET /api/v1/orders  (admin / seller / accountant / stock manager view — all orders)
const listOrders = asyncHandler(async (req, res) => {
  const { status, paymentStatus, q } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['createdAt', 'totalAmount'] });

  const where = {
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
    ...(q && { orderNumber: { contains: q, mode: 'insensitive' } }),
  };

  // A seller must only ever see orders that include at least one of their
  // own products — never the full platform order book. Orders with items
  // from several sellers are untouched by this filter and still show up
  // for every seller involved; getOrder (below) is what trims such an
  // order's *items* down to just that seller's own lines.
  if (req.user.role === 'SELLER') {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    if (!seller) {
      return success(res, 200, 'Orders fetched', [], buildMeta({ page, limit }, 0));
    }
    where.items = { some: { product: { sellerId: seller.id } } };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { _count: { select: { items: true } }, shipment: { select: { id: true, status: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  return success(res, 200, 'Orders fetched', orders, buildMeta({ page, limit }, total));
});

// GET /api/v1/orders/mine  (customer — their own order history)
const listMyOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['createdAt', 'totalAmount'] });

  const where = { customerId: req.user.id, ...(status && { status }) };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        _count: { select: { items: true } },
        items: { take: 3, include: { product: { select: { name: true, images: { where: { isPrimary: true, variantId: null }, take: 1 } } } } },
        shipment: { select: { status: true, trackingNumber: true, estimatedDeliveryDate: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return success(res, 200, 'Your orders fetched', orders, buildMeta({ page, limit }, total));
});

// GET /api/v1/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, sellerId: true, images: { where: { isPrimary: true, variantId: null }, take: 1 } } },
          variant: { select: { id: true, sku: true, attributes: true, imageUrl: true, images: { where: { isPrimary: true }, take: 1 } } },
        },
      },
      address: true,
      shipment: { include: { events: { orderBy: { createdAt: 'asc' } }, deliveryAgent: { select: { id: true, name: true, phone: true } } } },
    },
  });
  if (!order) throw new ApiError(404, 'Order not found.');

  // Customers may only view their own orders; staff roles can view any order.
  const staffRoles = ['SUPER_ADMIN', 'SELLER', 'ACCOUNTANT', 'STOCK_MANAGER'];
  if (req.user.role === 'CUSTOMER' && order.customerId !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to view this order.');
  }
  if (!staffRoles.includes(req.user.role) && req.user.role !== 'CUSTOMER') {
    throw new ApiError(403, 'You do not have permission to view this order.');
  }

  // A seller may only view orders that include one of their own products,
  // and even then only their own line items — an order that mixes products
  // from several sellers must never leak another seller's items to them.
  // This intentionally does not touch the order for other roles, and a
  // multi-seller order is untouched for *this* seller's own lines.
  if (req.user.role === 'SELLER') {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    const ownItems = seller ? order.items.filter((item) => item.product.sellerId === seller.id) : [];
    if (ownItems.length === 0) {
      throw new ApiError(403, 'You do not have permission to view this order — it does not contain any of your products.');
    }
    order.items = ownItems;
  }

  return success(res, 200, 'Order fetched', order);
});

// POST /api/v1/orders  — customer checkout: converts the cart into an Order
// body: { addressId, paymentMethod }
const checkout = asyncHandler(async (req, res) => {
  const { addressId, paymentMethod, couponCode } = req.body;
  if (!addressId) throw new ApiError(422, 'addressId is required.');
  if (!['COD', 'UPI', 'CARD', 'NETBANKING'].includes(paymentMethod)) {
    throw new ApiError(422, 'A valid paymentMethod is required (COD, UPI, CARD, NETBANKING).');
  }

  const address = await prisma.address.findFirst({ where: { id: addressId, userId: req.user.id } });
  if (!address) throw new ApiError(404, 'Address not found.');

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: { product: true, variant: true },
  });
  if (!cartItems.length) throw new ApiError(400, 'Your cart is empty.');

  // Verify stock availability up-front and pick a warehouse per line item.
  const lines = [];
  for (const ci of cartItems) {
    if (ci.product.status !== 'ACTIVE' && ci.product.status !== 'LOW_STOCK') {
      throw new ApiError(400, `"${ci.product.name}" is no longer available.`);
    }
    const inventories = await prisma.inventory.findMany({
      where: { productId: ci.productId, variantId: ci.variantId || null },
      orderBy: { quantityOnHand: 'desc' },
    });
    const warehouseStock = inventories.find((inv) => inv.quantityOnHand - inv.quantityReserved >= ci.quantity);
    if (!warehouseStock) {
      throw new ApiError(400, `Insufficient stock for "${ci.product.name}". Please reduce the quantity.`);
    }
    const unitPrice = Number(ci.variant?.price ?? ci.product.sellingPrice);
    lines.push({ cartItem: ci, warehouseId: warehouseStock.warehouseId, unitPrice });
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.cartItem.quantity, 0);
  const tax = lines.reduce((s, l) => s + (l.unitPrice * l.cartItem.quantity * Number(l.cartItem.product.taxPct || 0)) / 100, 0);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  // Re-validate any coupon (and check for a better automatic offer) against
  // the server's own view of the cart — never trust a discount amount the
  // client might send, only the code.
  const offerLines = lines.map((l) => ({
    productId: l.cartItem.productId,
    categoryId: l.cartItem.product.categoryId,
    brandId: l.cartItem.product.brandId,
    unitPrice: l.unitPrice,
    quantity: l.cartItem.quantity,
  }));
  const bestOffer = await resolveBestOffer(offerLines, req.user.id, couponCode);
  const discount = bestOffer?.discount || 0;

  const totalAmount = Math.round((subtotal + tax + shippingFee - discount) * 100) / 100;

  const shippingAddressSnapshot = {
    label: address.label, fullName: address.fullName, phone: address.phone,
    addressLine: address.addressLine, landmark: address.landmark, city: address.city,
    state: address.state, country: address.country, pincode: address.pincode,
  };

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: req.user.id,
        status: 'PENDING',
        paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
        paymentMethod,
        subtotal: Math.round(subtotal * 100) / 100,
        discount,
        couponCode: bestOffer?.offer?.type === 'COUPON' ? bestOffer.offer.code : null,
        tax: Math.round(tax * 100) / 100,
        shippingFee,
        totalAmount,
        addressId: address.id,
        shippingAddress: shippingAddressSnapshot,
        items: {
          create: lines.map((l) => ({
            productId: l.cartItem.productId,
            variantId: l.cartItem.variantId,
            quantity: l.cartItem.quantity,
            price: l.unitPrice,
            warehouseId: l.warehouseId, // remembered so ship/cancel/return touch the right warehouse
          })),
        },
      },
      include: { items: true },
    });

    // Reserve stock for every line item. This only raises quantityReserved —
    // the physical quantityOnHand doesn't move until the order ships.
    for (const l of lines) {
      await reserveStock({
        productId: l.cartItem.productId,
        variantId: l.cartItem.variantId,
        warehouseId: l.warehouseId,
        quantity: l.cartItem.quantity,
        reference: created.orderNumber,
        performedById: req.user.id,
      });
    }

    // Record the redemption and bump the offer's usage counter atomically
    // with the order itself, so a concurrent checkout can never blow past
    // usageLimit — both writes commit together or not at all.
    if (bestOffer) {
      await tx.offerRedemption.create({
        data: { offerId: bestOffer.offer.id, userId: req.user.id, orderId: created.id, discountAmount: discount },
      });
      await tx.offer.update({ where: { id: bestOffer.offer.id }, data: { usedCount: { increment: 1 } } });
    }

    await tx.cartItem.deleteMany({ where: { userId: req.user.id } });

    return created;
  });

  await createNotification({
    role: 'SUPER_ADMIN',
    title: 'New order placed',
    message: `Order ${order.orderNumber} was placed for ${totalAmount}.`,
    type: 'INFO',
  });

  return success(res, 201, 'Order placed successfully', order);
});

// PATCH /api/v1/orders/:id/status   body: { status }
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: { select: { sellerId: true } } } } },
  });
  if (!order) throw new ApiError(404, 'Order not found.');

  // A seller may only act on orders that actually contain one of their own
  // products — otherwise Seller A could confirm/ship/cancel an order that
  // belongs entirely to Seller B. SUPER_ADMIN and STOCK_MANAGER aren't
  // scoped to a single seller, so they can act on any order.
  if (req.user.role === 'SELLER') {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    const ownsAnItem = !!seller && order.items.some((item) => item.product.sellerId === seller.id);
    if (!ownsAnItem) {
      throw new ApiError(403, 'You do not have permission to update this order — it does not contain any of your products.');
    }
  }

  const allowedNext = NEXT_STATUS[order.status] || [];
  if (!allowedNext.includes(status)) {
    throw new ApiError(400, `Cannot move order from ${order.status} to ${status}.`);
  }

  // Stock side-effects for the transition, keyed off the order's status
  // *before* this update — this is what tells us whether each line's
  // reservation has already been fulfilled (physically shipped) or not.
  if (status === 'SHIPPED') {
    // Stock is actually leaving the warehouse now — convert every line's
    // reservation into a real physical removal.
    for (const item of order.items) {
      if (item.fulfilled || !item.warehouseId) continue;
      await fulfillReservation({
        productId: item.productId, variantId: item.variantId, warehouseId: item.warehouseId,
        quantity: item.quantity, reference: order.orderNumber, performedById: req.user.id,
      });
      await prisma.orderItem.update({ where: { id: item.id }, data: { fulfilled: true } });
    }
  } else if (status === 'CANCELLED') {
    for (const item of order.items) {
      if (!item.warehouseId) continue;
      if (item.fulfilled) {
        // Already physically shipped — cancelling now means the goods come back.
        await applyStockMovement({
          productId: item.productId, variantId: item.variantId, warehouseId: item.warehouseId,
          quantity: item.quantity, type: 'RETURN_RESTOCK',
          reference: order.orderNumber, reason: 'Order cancelled after shipment', performedById: req.user.id,
        });
      } else {
        // Never left the warehouse — just release the hold on it.
        await releaseReservation({
          productId: item.productId, variantId: item.variantId, warehouseId: item.warehouseId,
          quantity: item.quantity, reference: order.orderNumber, performedById: req.user.id,
          reason: 'Order cancelled by staff',
        });
      }
    }
  } else if (status === 'RETURNED') {
    for (const item of order.items) {
      if (!item.warehouseId) continue;
      await applyStockMovement({
        productId: item.productId, variantId: item.variantId, warehouseId: item.warehouseId,
        quantity: item.quantity, type: 'RETURN_RESTOCK',
        reference: order.orderNumber, reason: 'Order returned by customer', performedById: req.user.id,
      });
    }
  }

  // Cash-on-delivery orders are conventionally marked PAID the moment the
  // parcel is actually delivered and the customer hands over cash — do that
  // automatically so accountants aren't stuck manually flipping every COD
  // order. Prepaid orders are untouched (already PAID or being handled
  // through the payment-status endpoint/refund flow).
  const paymentStatusUpdate =
    status === 'DELIVERED' && order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING'
      ? { paymentStatus: 'PAID' }
      : {};

  const updated = await prisma.order.update({
    where: { id: req.params.id },
    data: { status, ...paymentStatusUpdate },
  });
  return success(res, 200, 'Order status updated', updated);
});

// PATCH /api/v1/orders/:id/payment-status   body: { paymentStatus }
const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus } = req.body;
  if (!['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(paymentStatus)) {
    throw new ApiError(422, 'Invalid payment status.');
  }
  const order = await prisma.order.update({ where: { id: req.params.id }, data: { paymentStatus } });
  return success(res, 200, 'Payment status updated', order);
});

// PATCH /api/v1/orders/:id/cancel  (customer cancels their own pending/confirmed order)
const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, customerId: req.user.id }, include: { items: true } });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw new ApiError(400, 'This order can no longer be cancelled — please contact support.');
  }

  // A customer can only self-cancel while PENDING/CONFIRMED, i.e. before the
  // order has ever shipped, so every line is still just a reservation —
  // release it rather than touching physical stock.
  for (const item of order.items) {
    if (!item.warehouseId) continue;
    await releaseReservation({
      productId: item.productId, variantId: item.variantId, warehouseId: item.warehouseId,
      quantity: item.quantity, reference: order.orderNumber, performedById: req.user.id,
      reason: 'Order cancelled by customer',
    });
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });

  return success(res, 200, 'Order cancelled');
});

module.exports = {
  listOrders, listMyOrders, getOrder, checkout, updateOrderStatus, updatePaymentStatus, cancelMyOrder,
};
