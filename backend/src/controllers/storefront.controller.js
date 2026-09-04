const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { getActiveAutomaticOffers, bestOfferForProduct } = require('../services/offer.service');

// Public, customer-facing catalog endpoints. Only ever surfaces products that
// are ACTIVE and APPROVED — sellers' drafts/pending items never leak here.
const VISIBLE_WHERE = { status: { in: ['ACTIVE', 'LOW_STOCK'] }, approvalStatus: 'APPROVED' };

// GET /api/v1/storefront/products
const listStorefrontProducts = asyncHandler(async (req, res) => {
  const { q, category, brand, minPrice, maxPrice } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, {
    allowedSort: ['createdAt', 'sellingPrice', 'name'],
  });

  const where = {
    ...VISIBLE_WHERE,
    ...(category && { category: { slug: category } }),
    ...(brand && { brandId: brand }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { shortDesc: { contains: q, mode: 'insensitive' } },
      ],
    }),
    ...((minPrice || maxPrice) && {
      sellingPrice: {
        ...(minPrice && { gte: parseFloat(minPrice) }),
        ...(maxPrice && { lte: parseFloat(maxPrice) }),
      },
    }),
  };

  const [products, total, activeOffers] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true } },
        images: { where: { variantId: null }, orderBy: { sortOrder: 'asc' } },
        inventories: { select: { quantityOnHand: true, quantityReserved: true } },
        seller: { select: { id: true, storeName: true } },
        reviews: { select: { rating: true }, where: { status: 'APPROVED' } },
      },
    }),
    prisma.product.count({ where }),
    getActiveAutomaticOffers(),
  ]);

  const shaped = products.map((p) => shapeProduct(p, activeOffers));
  return success(res, 200, 'Products fetched', shaped, buildMeta({ page, limit }, total));
});

// GET /api/v1/storefront/products/:slug
const getStorefrontProduct = asyncHandler(async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, ...VISIBLE_WHERE },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true } },
      images: { where: { variantId: null }, orderBy: { sortOrder: 'asc' } },
      variants: { where: { isActive: true }, include: { images: { orderBy: { sortOrder: 'asc' } } } },
      inventories: { select: { quantityOnHand: true, quantityReserved: true, warehouseId: true, variantId: true } },
      seller: { select: { id: true, storeName: true, city: true, state: true } },
      reviews: {
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { customer: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
  if (!product) throw new ApiError(404, 'Product not found.');

  const [related, activeOffers] = await Promise.all([
    prisma.product.findMany({
      where: { ...VISIBLE_WHERE, categoryId: product.categoryId, id: { not: product.id } },
      take: 8,
      include: { images: { where: { isPrimary: true, variantId: null }, take: 1 } },
    }),
    getActiveAutomaticOffers(),
  ]);

  return success(res, 200, 'Product fetched', {
    ...shapeProduct(product, activeOffers),
    related: related.map((p) => shapeProduct(p, activeOffers)),
  });
});

// `offers` is the pre-fetched list of currently-active AUTOMATIC offers
// (see offer.service#getActiveAutomaticOffers) — passed in so callers that
// shape many products in one request only fetch that list once. Every
// shaped product gets the *real*, live discount a shopper would actually
// receive (matching an ALL/CATEGORY/BRAND/PRODUCT offer against it), not
// just the static mrp-vs-sellingPrice difference stored on the row.
function shapeProduct(p, offers = []) {
  const totalStock = (p.inventories || []).reduce((sum, i) => sum + i.quantityOnHand - i.quantityReserved, 0);
  const avgRating = p.reviews?.length
    ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
    : null;

  // Attach each variant's own available stock (summed across warehouses)
  // so the storefront can show/enforce stock for the *selected* variant
  // instead of only ever showing the whole product's total.
  const variants = p.variants?.map((v) => ({
    ...v,
    stock: (p.inventories || [])
      .filter((i) => i.variantId === v.id)
      .reduce((sum, i) => sum + i.quantityOnHand - i.quantityReserved, 0),
  }));

  const sellingPrice = Number(p.sellingPrice);
  const best = offers.length ? bestOfferForProduct(offers, p) : null;
  const effectivePrice = best
    ? Math.max(0, Math.round((sellingPrice - best.discount) * 100) / 100)
    : sellingPrice;

  return {
    ...p,
    ...(variants && { variants }),
    totalStock,
    inStock: totalStock > 0,
    avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    reviewCount: p.reviews?.length || 0,
    effectivePrice,
    activeOffer: best
      ? {
          id: best.offer.id,
          title: best.offer.title,
          discountType: best.offer.discountType,
          discountValue: Number(best.offer.discountValue),
          discountAmount: best.discount,
        }
      : null,
  };
}

module.exports = { listStorefrontProducts, getStorefrontProduct };
