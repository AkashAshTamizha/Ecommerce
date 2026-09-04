const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { validateCoupon, findAutomaticOffers } = require('../services/offer.service');

const REF_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, slug: true } },
};

function normalizeCode(code) {
  return code ? code.trim().toUpperCase() : null;
}

// Builds the { productId, categoryId, brandId, unitPrice, quantity }[] shape
// the offer service needs, straight from the signed-in customer's cart.
async function getCartLines(userId) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: { select: { categoryId: true, brandId: true, sellingPrice: true } }, variant: { select: { price: true } } },
  });
  return items.map((i) => ({
    productId: i.productId,
    categoryId: i.product.categoryId,
    brandId: i.product.brandId,
    unitPrice: Number(i.variant?.price ?? i.product.sellingPrice),
    quantity: i.quantity,
  }));
}

// -------------------- ADMIN --------------------

// GET /api/v1/offers  (admin — all offers, paginated)
const listOffers = asyncHandler(async (req, res) => {
  const { type, isActive, q } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, { allowedSort: ['createdAt', 'title', 'usedCount', 'endsAt'] });

  const where = {
    ...(type && { type }),
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };

  const [offers, total] = await Promise.all([
    prisma.offer.findMany({ where, skip, take, orderBy, include: REF_INCLUDE }),
    prisma.offer.count({ where }),
  ]);

  return success(res, 200, 'Offers fetched', offers, buildMeta({ page, limit }, total));
});

// GET /api/v1/offers/:id  (admin)
const getOffer = asyncHandler(async (req, res) => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { ...REF_INCLUDE, _count: { select: { redemptions: true } } },
  });
  if (!offer) throw new ApiError(404, 'Offer not found.');
  return success(res, 200, 'Offer fetched', offer);
});

function buildOfferData(body) {
  const {
    title, description, code, type, discountType, discountValue, maxDiscountAmount,
    minOrderAmount, scope, categoryId, brandId, productId, startsAt, endsAt,
    usageLimit, usageLimitPerUser, isActive,
  } = body;

  const resolvedType = type || 'COUPON';
  const resolvedScope = scope || 'ALL';

  return {
    title,
    description: description || null,
    // AUTOMATIC offers never take a code, even if one was sent by mistake.
    code: resolvedType === 'AUTOMATIC' ? null : normalizeCode(code),
    type: resolvedType,
    discountType: discountType || 'PERCENTAGE',
    discountValue,
    maxDiscountAmount: maxDiscountAmount === '' || maxDiscountAmount == null ? null : maxDiscountAmount,
    minOrderAmount: minOrderAmount || 0,
    scope: resolvedScope,
    categoryId: resolvedScope === 'CATEGORY' ? categoryId : null,
    brandId: resolvedScope === 'BRAND' ? brandId : null,
    productId: resolvedScope === 'PRODUCT' ? productId : null,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
    usageLimit: usageLimit === '' || usageLimit == null ? null : Number(usageLimit),
    usageLimitPerUser: usageLimitPerUser === '' || usageLimitPerUser == null ? null : Number(usageLimitPerUser),
    ...(isActive !== undefined && { isActive }),
  };
}

// POST /api/v1/offers  (admin)
const createOffer = asyncHandler(async (req, res) => {
  const { title, type, discountType, discountValue, scope, code } = req.body;
  if (!title) throw new ApiError(422, 'Title is required.');
  if (discountValue === undefined || Number(discountValue) <= 0) {
    throw new ApiError(422, 'Discount value must be a positive number.');
  }
  if (discountType === 'PERCENTAGE' && Number(discountValue) > 100) {
    throw new ApiError(422, 'A percentage discount cannot exceed 100.');
  }
  if ((type || 'COUPON') === 'COUPON' && !code) {
    throw new ApiError(422, 'A coupon code is required for coupon-type offers.');
  }
  if ((scope === 'CATEGORY' && !req.body.categoryId) ||
      (scope === 'BRAND' && !req.body.brandId) ||
      (scope === 'PRODUCT' && !req.body.productId)) {
    throw new ApiError(422, `A ${(scope || '').toLowerCase()} must be selected for this scope.`);
  }

  if (code) {
    const existing = await prisma.offer.findUnique({ where: { code: normalizeCode(code) } });
    if (existing) throw new ApiError(409, 'An offer with this code already exists.');
  }

  const offer = await prisma.offer.create({ data: buildOfferData(req.body), include: REF_INCLUDE });
  return success(res, 201, 'Offer created', offer);
});

// PATCH /api/v1/offers/:id  (admin)
const updateOffer = asyncHandler(async (req, res) => {
  const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Offer not found.');

  if (req.body.discountType === 'PERCENTAGE' && req.body.discountValue !== undefined && Number(req.body.discountValue) > 100) {
    throw new ApiError(422, 'A percentage discount cannot exceed 100.');
  }

  if (req.body.code) {
    const codeOwner = await prisma.offer.findUnique({ where: { code: normalizeCode(req.body.code) } });
    if (codeOwner && codeOwner.id !== existing.id) throw new ApiError(409, 'An offer with this code already exists.');
  }

  const merged = { ...existing, ...req.body };
  const offer = await prisma.offer.update({
    where: { id: req.params.id },
    data: buildOfferData(merged),
    include: REF_INCLUDE,
  });
  return success(res, 200, 'Offer updated', offer);
});

// PATCH /api/v1/offers/:id/toggle  (admin — quick activate/deactivate)
const toggleOffer = asyncHandler(async (req, res) => {
  const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Offer not found.');
  const offer = await prisma.offer.update({ where: { id: req.params.id }, data: { isActive: !existing.isActive } });
  return success(res, 200, `Offer ${offer.isActive ? 'activated' : 'deactivated'}`, offer);
});

// DELETE /api/v1/offers/:id  (admin)
const deleteOffer = asyncHandler(async (req, res) => {
  const redemptionCount = await prisma.offerRedemption.count({ where: { offerId: req.params.id } });
  if (redemptionCount > 0) {
    // Preserve the audit trail on past orders — deactivate instead of deleting.
    const offer = await prisma.offer.update({ where: { id: req.params.id }, data: { isActive: false } });
    return success(res, 200, 'Offer has past redemptions, so it was deactivated instead of deleted', offer);
  }
  await prisma.offer.delete({ where: { id: req.params.id } });
  return success(res, 200, 'Offer deleted');
});

// -------------------- STOREFRONT / CUSTOMER --------------------

// GET /api/v1/offers/active  (public — deals & coupons customers can browse)
const listActiveOffers = asyncHandler(async (req, res) => {
  const now = new Date();
  const offers = await prisma.offer.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    include: REF_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  return success(res, 200, 'Active offers fetched', offers);
});

// POST /api/v1/offers/apply   body: { code }
// Validates a coupon against the signed-in customer's current cart and
// returns the discount it would produce — used for the "Apply Coupon" box
// on the cart/checkout page. Does NOT persist anything; the discount is
// only actually committed when the order is placed (see order.controller).
const applyCoupon = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const lines = await getCartLines(req.user.id);
  if (!lines.length) throw new ApiError(400, 'Your cart is empty.');

  const { offer, discount } = await validateCoupon(code, lines, req.user.id);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  return success(res, 200, 'Coupon applied', {
    code: offer.code,
    title: offer.title,
    discount,
    subtotal,
    total: Math.max(subtotal - discount, 0),
  });
});

// GET /api/v1/offers/best-automatic  (customer — best auto-applied deal for the current cart, if any)
const getBestAutomaticOffer = asyncHandler(async (req, res) => {
  const lines = await getCartLines(req.user.id);
  if (!lines.length) return success(res, 200, 'No automatic offers', null);

  const [best] = await findAutomaticOffers(lines, req.user.id);
  if (!best) return success(res, 200, 'No automatic offers', null);

  return success(res, 200, 'Best automatic offer found', { title: best.offer.title, discount: best.discount });
});

module.exports = {
  listOffers, getOffer, createOffer, updateOffer, toggleOffer, deleteOffer,
  listActiveOffers, applyCoupon, getBestAutomaticOffer,
};
