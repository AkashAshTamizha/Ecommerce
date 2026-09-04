const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { createNotification } = require('../services/notification.service');

// A customer may review a product only once they have an order for it that
// has actually been DELIVERED — this is what "verified purchase" means here.
// Used both by the eligibility check and defensively re-checked on create.
async function findVerifiedPurchase(customerId, productId) {
  return prisma.orderItem.findFirst({
    where: {
      productId,
      order: { customerId, status: 'DELIVERED' },
    },
    select: { id: true, orderId: true },
  });
}

// GET /api/v1/reviews/products/:productId
// Public — paginated, approved reviews for a product, newest first, plus a
// rating summary (average + count per star) so the frontend can render a
// breakdown without pulling every row.
const listProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { skip, take, page, limit } = getPagination(req.query, { allowedSort: ['createdAt'] });

  const where = { productId, status: 'APPROVED' };

  const [reviews, total, grouped] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ['rating'], where, _count: { rating: true } }),
  ]);

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  grouped.forEach((g) => { breakdown[g.rating] = g._count.rating; });
  const avgRating = total
    ? Math.round((grouped.reduce((sum, g) => sum + g.rating * g._count.rating, 0) / total) * 10) / 10
    : null;

  return success(res, 200, 'Reviews fetched', { reviews, avgRating, breakdown }, buildMeta({ page, limit }, total));
});

// GET /api/v1/reviews/products/:productId/eligibility
// CUSTOMER — tells the frontend whether to show the "write a review" form,
// and why not if it shouldn't (already reviewed vs. never delivered).
const getReviewEligibility = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const [purchase, existingReview] = await Promise.all([
    findVerifiedPurchase(req.user.id, productId),
    prisma.review.findUnique({
      where: { productId_customerId: { productId, customerId: req.user.id } },
    }),
  ]);

  return success(res, 200, 'Eligibility checked', {
    canReview: !!purchase && !existingReview,
    hasPurchased: !!purchase,
    alreadyReviewed: !!existingReview,
    existingReview,
  });
});

// POST /api/v1/reviews/products/:productId   body: { rating, comment? }
// CUSTOMER — create a review. Requires a DELIVERED order for this exact
// product; one review per customer per product (also enforced by a unique
// DB constraint, so a race between two requests can't slip both through).
const createReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, comment } = req.body;

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw new ApiError(422, 'rating must be a whole number between 1 and 5.');
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, sellerId: true } });
  if (!product) throw new ApiError(404, 'Product not found.');

  const purchase = await findVerifiedPurchase(req.user.id, productId);
  if (!purchase) {
    throw new ApiError(403, 'You can only review products from a delivered order.');
  }

  let review;
  try {
    review = await prisma.review.create({
      data: { productId, customerId: req.user.id, rating: ratingNum, comment: comment?.trim() || null },
      include: { customer: { select: { id: true, name: true, avatarUrl: true } } },
    });
  } catch (err) {
    if (err.code === 'P2002') throw new ApiError(409, 'You have already reviewed this product.');
    throw err;
  }

  // Best-effort — let the seller know, but never fail the review because a
  // notification couldn't be written.
  const seller = await prisma.seller.findUnique({ where: { id: product.sellerId }, select: { userId: true } });
  if (seller) {
    createNotification({
      userId: seller.userId,
      title: 'New product review',
      message: `${req.user.name} left a ${ratingNum}-star review on "${product.name}".`,
      type: 'INFO',
    }).catch(() => null);
  }

  return success(res, 201, 'Review submitted', review);
});

// DELETE /api/v1/reviews/:id
// CUSTOMER — remove your own review.
const deleteMyReview = asyncHandler(async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review || review.customerId !== req.user.id) {
    throw new ApiError(404, 'Review not found.');
  }
  await prisma.review.delete({ where: { id: review.id } });
  return success(res, 200, 'Review deleted');
});

module.exports = { listProductReviews, getReviewEligibility, createReview, deleteMyReview };
