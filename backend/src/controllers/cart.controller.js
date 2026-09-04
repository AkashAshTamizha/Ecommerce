const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');

const ITEM_INCLUDE = {
  product: {
    select: {
      id: true, name: true, slug: true, sku: true, sellingPrice: true, mrp: true, status: true,
      images: { where: { isPrimary: true, variantId: null }, take: 1 },
      inventories: { select: { quantityOnHand: true, quantityReserved: true } },
    },
  },
  variant: {
    select: {
      id: true, sku: true, attributes: true, price: true, imageUrl: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
  },
};

function shapeItem(item) {
  const stock = (item.product?.inventories || []).reduce((s, i) => s + i.quantityOnHand - i.quantityReserved, 0);
  const unitPrice = item.variant?.price ?? item.product?.sellingPrice ?? 0;
  return { ...item, unitPrice: Number(unitPrice), lineTotal: Number(unitPrice) * item.quantity, availableStock: stock };
}

// GET /api/v1/cart
const getCart = asyncHandler(async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: ITEM_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  const shaped = items.map(shapeItem);
  const subtotal = shaped.reduce((s, i) => s + i.lineTotal, 0);
  return success(res, 200, 'Cart fetched', { items: shaped, subtotal, itemCount: shaped.reduce((s, i) => s + i.quantity, 0) });
});

// POST /api/v1/cart   body: { productId, variantId?, quantity? }
const addToCart = asyncHandler(async (req, res) => {
  const { productId, variantId, quantity = 1 } = req.body;
  if (!productId) throw new ApiError(422, 'productId is required.');
  if (quantity < 1) throw new ApiError(422, 'quantity must be at least 1.');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  const existing = await prisma.cartItem.findFirst({
    where: { userId: req.user.id, productId, variantId: variantId || null },
  });

  const item = existing
    ? await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
        include: ITEM_INCLUDE,
      })
    : await prisma.cartItem.create({
        data: { userId: req.user.id, productId, variantId, quantity },
        include: ITEM_INCLUDE,
      });

  return success(res, 201, 'Added to cart', shapeItem(item));
});

// PATCH /api/v1/cart/:id   body: { quantity }
const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) throw new ApiError(422, 'quantity must be at least 1.');

  const existing = await prisma.cartItem.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) throw new ApiError(404, 'Cart item not found.');

  const item = await prisma.cartItem.update({
    where: { id: existing.id },
    data: { quantity },
    include: ITEM_INCLUDE,
  });
  return success(res, 200, 'Cart item updated', shapeItem(item));
});

// DELETE /api/v1/cart/:id
const removeCartItem = asyncHandler(async (req, res) => {
  const existing = await prisma.cartItem.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) throw new ApiError(404, 'Cart item not found.');
  await prisma.cartItem.delete({ where: { id: existing.id } });
  return success(res, 200, 'Removed from cart');
});

// DELETE /api/v1/cart
const clearCart = asyncHandler(async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
  return success(res, 200, 'Cart cleared');
});

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart };
