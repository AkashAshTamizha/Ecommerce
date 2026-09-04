const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');

// GET /api/v1/wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true, name: true, slug: true, sku: true, sellingPrice: true, mrp: true, status: true,
          images: { where: { isPrimary: true, variantId: null }, take: 1 },
          inventories: { select: { quantityOnHand: true, quantityReserved: true } },
        },
      },
    },
  });
  const shaped = items.map((i) => ({
    ...i,
    inStock: (i.product?.inventories || []).reduce((s, x) => s + x.quantityOnHand - x.quantityReserved, 0) > 0,
  }));
  return success(res, 200, 'Wishlist fetched', shaped);
});

// POST /api/v1/wishlist   body: { productId }
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  if (!productId) throw new ApiError(422, 'productId is required.');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  const existing = await prisma.wishlistItem.findFirst({ where: { userId: req.user.id, productId } });
  if (existing) return success(res, 200, 'Already in wishlist', existing);

  const item = await prisma.wishlistItem.create({ data: { userId: req.user.id, productId } });
  return success(res, 201, 'Added to wishlist', item);
});

// DELETE /api/v1/wishlist/:productId
const removeFromWishlist = asyncHandler(async (req, res) => {
  const existing = await prisma.wishlistItem.findFirst({
    where: { userId: req.user.id, productId: req.params.productId },
  });
  if (!existing) throw new ApiError(404, 'Item not in wishlist.');
  await prisma.wishlistItem.delete({ where: { id: existing.id } });
  return success(res, 200, 'Removed from wishlist');
});

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
