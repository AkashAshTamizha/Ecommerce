const prisma = require('../config/db');
const { ApiError } = require('../utils/apiResponse');

/**
 * A "line" is the shape both the cart and checkout flows already build:
 *   { productId, categoryId, brandId, unitPrice, quantity }
 * lineTotal is derived, not stored, so callers can pass raw cart/order lines.
 */
function lineTotal(line) {
  return line.unitPrice * line.quantity;
}

// Returns the subset of `lines` an offer's scope actually covers, and the
// subtotal of just that subset — e.g. a CATEGORY offer only discounts the
// lines in that category, not the whole cart.
function scopedLines(offer, lines) {
  switch (offer.scope) {
    case 'CATEGORY':
      return lines.filter((l) => l.categoryId === offer.categoryId);
    case 'BRAND':
      return lines.filter((l) => l.brandId === offer.brandId);
    case 'PRODUCT':
      return lines.filter((l) => l.productId === offer.productId);
    case 'ALL':
    default:
      return lines;
  }
}

/**
 * Computes how much a single offer knocks off, given the cart lines it
 * would apply to. Returns 0 if the offer's minOrderAmount isn't met or
 * none of the cart matches its scope — never throws, so callers can use
 * this to silently skip non-matching AUTOMATIC offers.
 */
function computeDiscount(offer, lines) {
  const targeted = scopedLines(offer, lines);
  const targetedSubtotal = targeted.reduce((s, l) => s + lineTotal(l), 0);
  const cartSubtotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  if (targetedSubtotal <= 0) return 0;
  if (cartSubtotal < Number(offer.minOrderAmount || 0)) return 0;

  let discount =
    offer.discountType === 'PERCENTAGE'
      ? (targetedSubtotal * Number(offer.discountValue)) / 100
      : Number(offer.discountValue);

  if (offer.discountType === 'PERCENTAGE' && offer.maxDiscountAmount != null) {
    discount = Math.min(discount, Number(offer.maxDiscountAmount));
  }

  // A flat discount can never exceed what it's actually being applied to.
  discount = Math.min(discount, targetedSubtotal);

  return Math.round(discount * 100) / 100;
}

function isWithinWindow(offer, now = new Date()) {
  if (offer.startsAt && now < offer.startsAt) return false;
  if (offer.endsAt && now > offer.endsAt) return false;
  return true;
}

async function hasUsageLeft(offer, userId) {
  if (offer.usageLimit != null && offer.usedCount >= offer.usageLimit) return false;
  if (offer.usageLimitPerUser != null) {
    const usedByUser = await prisma.offerRedemption.count({ where: { offerId: offer.id, userId } });
    if (usedByUser >= offer.usageLimitPerUser) return false;
  }
  return true;
}

// Every currently-active AUTOMATIC offer, best (highest discount) one
// first, so callers that only want to stack a subset can just take([0]).
async function findAutomaticOffers(lines, userId) {
  const now = new Date();
  const candidates = await prisma.offer.findMany({
    where: {
      type: 'AUTOMATIC',
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
  });

  const applicable = [];
  for (const offer of candidates) {
    if (!isWithinWindow(offer, now)) continue;
    const discount = computeDiscount(offer, lines);
    if (discount <= 0) continue;
    if (!(await hasUsageLeft(offer, userId))) continue;
    applicable.push({ offer, discount });
  }

  return applicable.sort((a, b) => b.discount - a.discount);
}

/**
 * Validates a coupon code against the current cart/order lines for a given
 * user and returns { offer, discount }. Throws ApiError(4xx) with a
 * customer-friendly message on any failure — callers don't need to
 * duplicate validation messaging.
 */
async function validateCoupon(code, lines, userId) {
  if (!code || !code.trim()) throw new ApiError(422, 'Please enter a coupon code.');

  const offer = await prisma.offer.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!offer || offer.type !== 'COUPON') throw new ApiError(404, 'This coupon code is not valid.');
  if (!offer.isActive) throw new ApiError(400, 'This coupon is no longer active.');
  if (!isWithinWindow(offer)) throw new ApiError(400, 'This coupon has expired or is not yet active.');
  if (!(await hasUsageLeft(offer, userId))) {
    throw new ApiError(400, 'This coupon has already reached its usage limit.');
  }

  const discount = computeDiscount(offer, lines);
  if (discount <= 0) {
    throw new ApiError(400, `This coupon requires a minimum order of ${offer.minOrderAmount}, or doesn't apply to the items in your cart.`);
  }

  return { offer, discount };
}

// Picks the single best combination for checkout: the best of (a) the
// customer's chosen coupon and (b) the best automatic offer, since offers
// aren't stacked in this model — whichever nets the bigger discount wins.
async function resolveBestOffer(lines, userId, couponCode) {
  const automatic = await findAutomaticOffers(lines, userId);
  const best = automatic[0] || null;

  if (!couponCode) return best;

  const couponResult = await validateCoupon(couponCode, lines, userId);
  if (!best || couponResult.discount >= best.discount) return couponResult;
  return best;
}

// Every currently-active AUTOMATIC offer that still has total usage left,
// regardless of any particular user or cart — used to price storefront
// listings/detail pages where there's no cart context (and possibly no
// logged-in user at all) to check per-user limits against.
async function getActiveAutomaticOffers(now = new Date()) {
  const candidates = await prisma.offer.findMany({
    where: {
      type: 'AUTOMATIC',
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
  });
  return candidates.filter(
    (o) => isWithinWindow(o, now) && (o.usageLimit == null || o.usedCount < o.usageLimit)
  );
}

// Given a pre-fetched list of active AUTOMATIC offers and a single product,
// finds the single best one that actually applies to it (matching scope +
// minOrderAmount against that product's own price) and how much it knocks
// off. Returns null if none apply. Treats the product as a lone one-item
// cart, so ALL-scope offers with a minOrderAmount above the product's price
// correctly won't show as applying to it on its own.
function bestOfferForProduct(offers, product) {
  const line = {
    productId: product.id,
    categoryId: product.categoryId,
    brandId: product.brandId,
    unitPrice: Number(product.sellingPrice),
    quantity: 1,
  };

  let best = null;
  for (const offer of offers) {
    const discount = computeDiscount(offer, [line]);
    if (discount > 0 && (!best || discount > best.discount)) {
      best = { offer, discount };
    }
  }
  return best;
}

module.exports = {
  computeDiscount,
  findAutomaticOffers,
  validateCoupon,
  resolveBestOffer,
  isWithinWindow,
  hasUsageLeft,
  getActiveAutomaticOffers,
  bestOfferForProduct,
};
