const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { cloudinary } = require('../config/cloudinary');
const { createNotification } = require('../services/notification.service');
const { generateSKU, slugify } = require('../utils/slug');

// Helper: scope product queries to the caller's own store unless they're a Super Admin
async function getSellerScope(user) {
  if (user.role === 'SUPER_ADMIN') return null; // no restriction
  const seller = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!seller) throw new ApiError(403, 'No seller profile found for this account.');
  return seller.id;
}

// GET /api/v1/products
const listProducts = asyncHandler(async (req, res) => {
  const { q, category, brand, status, approvalStatus, sellerId } = req.query;
  const { skip, take, orderBy, page, limit } = getPagination(req.query, {
    allowedSort: ['createdAt', 'name', 'sellingPrice', 'stock'],
  });

  const scopedSellerId = await getSellerScope(req.user);

  const where = {
    ...(scopedSellerId && { sellerId: scopedSellerId }),
    ...(sellerId && !scopedSellerId && { sellerId }),
    ...(category && { categoryId: category }),
    ...(brand && { brandId: brand }),
    ...(status && { status }),
    ...(approvalStatus && { approvalStatus }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: { where: { isPrimary: true, variantId: null }, take: 1 },
        inventories: { select: { quantityOnHand: true, quantityReserved: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const shaped = products.map((p) => ({
    ...p,
    totalStock: p.inventories.reduce((sum, i) => sum + i.quantityOnHand - i.quantityReserved, 0),
  }));

  return success(res, 200, 'Products fetched', shaped, buildMeta({ page, limit }, total));
});

// GET /api/v1/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const scopedSellerId = await getSellerScope(req.user);

  const product = await prisma.product.findFirst({
    where: { id: req.params.id, ...(scopedSellerId && { sellerId: scopedSellerId }) },
    include: {
      category: true,
      brand: true,
      images: { where: { variantId: null }, orderBy: { sortOrder: 'asc' } },
      variants: { include: { images: { orderBy: { sortOrder: 'asc' } } } },
      inventories: { include: { warehouse: { select: { id: true, name: true, code: true } } } },
      seller: { select: { id: true, storeName: true } },
    },
  });

  if (!product) throw new ApiError(404, 'Product not found.');
  return success(res, 200, 'Product fetched', product);
});

// POST /api/v1/products
const createProduct = asyncHandler(async (req, res) => {
  const scopedSellerId = await getSellerScope(req.user);
  const sellerId = scopedSellerId || req.body.sellerId;
  if (!sellerId) throw new ApiError(400, 'sellerId is required.');

  const {
    name, categoryId, brandId, barcode, shortDesc, fullDesc,
    mrp, sellingPrice, costPrice, discountType, discountValue, taxPct,
    weightKg, lengthCm, widthCm, heightCm, shippingClass, shipsFrom,
    minStockLevel, maxStockLevel,
  } = req.body;

  const sku = req.body.sku || generateSKU(name);
  const slug = slugify(name) + '-' + Date.now().toString(36);

  const product = await prisma.product.create({
    data: {
      name, sku, barcode, shortDesc, fullDesc, slug,
      categoryId, brandId, sellerId,
      mrp, sellingPrice, costPrice, discountType, discountValue,
      taxPct: taxPct || 0,
      weightKg, lengthCm, widthCm, heightCm, shippingClass, shipsFrom,
      minStockLevel: minStockLevel || 5,
      maxStockLevel: maxStockLevel || 100,
      status: 'DRAFT',
      approvalStatus: req.user.role === 'SUPER_ADMIN' ? 'APPROVED' : 'PENDING',
    },
  });

  // Notify Super Admins when a seller submits a new product for review
  if (req.user.role === 'SELLER') {
    await createNotification({
      role: 'SUPER_ADMIN',
      title: 'New product pending approval',
      message: `"${product.name}" was submitted and is awaiting review.`,
      type: 'INFO',
    });
  }

  return success(res, 201, 'Product created', product);
});

// PATCH /api/v1/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const scopedSellerId = await getSellerScope(req.user);

  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, ...(scopedSellerId && { sellerId: scopedSellerId }) },
  });
  if (!existing) throw new ApiError(404, 'Product not found.');

  const allowedFields = [
    'name', 'categoryId', 'brandId', 'barcode', 'shortDesc', 'fullDesc',
    'mrp', 'sellingPrice', 'costPrice', 'discountType', 'discountValue', 'taxPct',
    'weightKg', 'lengthCm', 'widthCm', 'heightCm', 'shippingClass', 'shipsFrom',
    'metaTitle', 'metaDescription', 'urlSlug', 'status',
    'minStockLevel', 'maxStockLevel',
  ];
  const data = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }

  // Editing a live product sends it back for re-approval unless an admin is editing
  if (req.user.role === 'SELLER' && Object.keys(data).length) {
    data.approvalStatus = 'PENDING';
  }

  const product = await prisma.product.update({ where: { id: existing.id }, data });
  return success(res, 200, 'Product updated', product);
});

// DELETE /api/v1/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const scopedSellerId = await getSellerScope(req.user);

  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, ...(scopedSellerId && { sellerId: scopedSellerId }) },
    include: { images: true },
  });
  if (!existing) throw new ApiError(404, 'Product not found.');

  // Clean up Cloudinary assets before deleting the DB record
  await Promise.all(
    existing.images.map((img) => cloudinary.uploader.destroy(img.publicId).catch(() => null))
  );

  await prisma.product.delete({ where: { id: existing.id } });
  return success(res, 200, 'Product deleted');
});

// PATCH /api/v1/products/:id/approve
const approveProduct = asyncHandler(async (req, res) => {
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { approvalStatus: 'APPROVED', status: 'ACTIVE', rejectionReason: null },
  });
  return success(res, 200, 'Product approved', product);
});

// PATCH /api/v1/products/:id/reject
const rejectProduct = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) throw new ApiError(400, 'A rejection reason is required.');

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { approvalStatus: 'REJECTED', status: 'INACTIVE', rejectionReason: reason },
  });
  return success(res, 200, 'Product rejected', product);
});

// POST /api/v1/products/:id/images  (multipart, field name: "images")
const uploadImages = asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) throw new ApiError(404, 'Product not found.');

  if (!req.files?.length) throw new ApiError(400, 'No image files were uploaded.');

  const existingCount = await prisma.productImage.count({ where: { productId: product.id } });

  const images = await prisma.$transaction(
    req.files.map((file, idx) =>
      prisma.productImage.create({
        data: {
          productId: product.id,
          url: file.path, // secure Cloudinary URL
          publicId: file.filename, // Cloudinary public_id
          isPrimary: existingCount === 0 && idx === 0,
          sortOrder: existingCount + idx,
        },
      })
    )
  );

  return success(res, 201, 'Images uploaded', images);
});

// DELETE /api/v1/products/:id/images/:imageId
const deleteImage = asyncHandler(async (req, res) => {
  const image = await prisma.productImage.findFirst({
    where: { id: req.params.imageId, productId: req.params.id },
  });
  if (!image) throw new ApiError(404, 'Image not found.');

  await cloudinary.uploader.destroy(image.publicId).catch(() => null);
  await prisma.productImage.delete({ where: { id: image.id } });

  return success(res, 200, 'Image deleted');
});

// POST /api/v1/products/:id/variants/:variantId/images
// Uploads one or more images to a variant's own gallery. The first image
// ever uploaded for a variant becomes its "front" (primary) image
// automatically; everything else lands in "other images".
const uploadVariantImages = asyncHandler(async (req, res) => {
  const variant = await prisma.productVariant.findFirst({
    where: { id: req.params.variantId, productId: req.params.id },
  });
  if (!variant) throw new ApiError(404, 'Variant not found.');

  if (!req.files?.length) throw new ApiError(400, 'No image files were uploaded.');

  const existingCount = await prisma.productImage.count({ where: { variantId: variant.id } });

  const images = await prisma.$transaction(
    req.files.map((file, idx) =>
      prisma.productImage.create({
        data: {
          productId: variant.productId,
          variantId: variant.id,
          url: file.path, // secure Cloudinary URL
          publicId: file.filename, // Cloudinary public_id
          isPrimary: existingCount === 0 && idx === 0,
          sortOrder: existingCount + idx,
        },
      })
    )
  );

  return success(res, 201, 'Variant images uploaded', images);
});

// PATCH /api/v1/products/:id/variants/:variantId/images/:imageId/primary
// Marks one of the variant's existing images as the "front" image,
// demoting whichever image previously held that spot.
const setVariantPrimaryImage = asyncHandler(async (req, res) => {
  const image = await prisma.productImage.findFirst({
    where: { id: req.params.imageId, variantId: req.params.variantId },
  });
  if (!image) throw new ApiError(404, 'Variant image not found.');

  await prisma.$transaction([
    prisma.productImage.updateMany({
      where: { variantId: req.params.variantId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.productImage.update({ where: { id: image.id }, data: { isPrimary: true } }),
  ]);

  return success(res, 200, 'Front image updated');
});

// DELETE /api/v1/products/:id/variants/:variantId/images/:imageId
const deleteVariantImage = asyncHandler(async (req, res) => {
  const image = await prisma.productImage.findFirst({
    where: { id: req.params.imageId, variantId: req.params.variantId },
  });
  if (!image) throw new ApiError(404, 'Variant image not found.');

  await cloudinary.uploader.destroy(image.publicId).catch(() => null);
  await prisma.productImage.delete({ where: { id: image.id } });

  // If the front image was just deleted, promote the next remaining one
  // so the variant never ends up with images but no designated front.
  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { variantId: req.params.variantId },
      orderBy: { sortOrder: 'asc' },
    });
    if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }

  return success(res, 200, 'Variant image deleted');
});

// POST /api/v1/products/bulk-action  { productIds: [], action: 'approve'|'reject'|'delete'|'activate'|'deactivate' }
const bulkAction = asyncHandler(async (req, res) => {
  const { productIds, action, reason } = req.body;
  if (!Array.isArray(productIds) || !productIds.length) {
    throw new ApiError(400, 'productIds must be a non-empty array.');
  }

  const actionMap = {
    approve: { approvalStatus: 'APPROVED', status: 'ACTIVE' },
    reject: { approvalStatus: 'REJECTED', status: 'INACTIVE', rejectionReason: reason || 'Rejected in bulk action' },
    activate: { status: 'ACTIVE' },
    deactivate: { status: 'INACTIVE' },
  };

  if (action === 'delete') {
    const result = await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    return success(res, 200, `${result.count} product(s) deleted`);
  }

  if (!actionMap[action]) throw new ApiError(400, 'Invalid bulk action.');

  const result = await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: actionMap[action],
  });

  return success(res, 200, `${result.count} product(s) updated`);
});

// ------------------------------------------------------------
// PRODUCT VARIANTS
// Variants capture attribute combinations (Color, Size, Series,
// Motor Technology, Capacity, etc.) that each carry their own SKU,
// price and stock. `attributes` is a free-form JSON map so any
// attribute name can be used — the UI just suggests common ones.
// ------------------------------------------------------------

// Trims key/value whitespace and standardizes casing so "White", " White",
// and "white" are all treated as the same value. Without this, a variant's
// attributes can differ from another's only by stray whitespace/casing —
// they display as if they were the same option, but strict equality checks
// on the frontend (and here) silently fail to treat them as identical,
// which is exactly the kind of "variant selection acts wrong" symptom this
// project needed to avoid.
function normalizeAttributes(attributes) {
  const normalized = {};
  for (const [key, value] of Object.entries(attributes)) {
    const cleanKey = String(key).trim();
    const cleanValue = String(value).trim();
    if (!cleanKey || !cleanValue) continue;
    normalized[cleanKey] = cleanValue;
  }
  return normalized;
}

// Two attribute maps represent the same combination if they have the same
// keys (case/whitespace-insensitive) each mapped to the same value.
function attributesMatch(a, b) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => b[k] !== undefined && b[k].toLowerCase() === a[k].toLowerCase());
}

// Enforces requirement: "Do not create duplicate variants." Without this,
// two variants with the identical attribute combination (e.g. two
// White/Size 6 rows) can coexist — `.find()`-based lookups always resolve
// to whichever was created first, so the second one becomes a permanently
// unreachable "ghost" variant with its own stock/price that customers can
// never actually select.
async function assertUniqueAttributes(productId, attributes, excludeVariantId) {
  const siblings = await prisma.productVariant.findMany({
    where: { productId, ...(excludeVariantId && { id: { not: excludeVariantId } }) },
    select: { id: true, attributes: true },
  });
  const clash = siblings.some((v) => attributesMatch(normalizeAttributes(v.attributes || {}), attributes));
  if (clash) {
    throw new ApiError(409, 'A variant with this exact attribute combination already exists for this product.');
  }
}

// POST /api/v1/products/:id/variants
// body: { attributes: {Color, Size, ...}, sku?, price, compareAtPrice?,
//         imageUrl?, quantity?, warehouseId? }
const createVariant = asyncHandler(async (req, res) => {
  const scopedSellerId = await getSellerScope(req.user);
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, ...(scopedSellerId && { sellerId: scopedSellerId }) },
  });
  if (!product) throw new ApiError(404, 'Product not found.');

  const { attributes: rawAttributes, sku, price, compareAtPrice, imageUrl, quantity, warehouseId } = req.body;
  if (!rawAttributes || typeof rawAttributes !== 'object' || !Object.keys(rawAttributes).length) {
    throw new ApiError(422, 'At least one attribute (e.g. Color, Size) is required.');
  }
  if (price === undefined || price === null) throw new ApiError(422, 'price is required.');
  if (quantity && !warehouseId) throw new ApiError(422, 'warehouseId is required to set an initial quantity.');

  const attributes = normalizeAttributes(rawAttributes);
  if (!Object.keys(attributes).length) {
    throw new ApiError(422, 'At least one attribute (e.g. Color, Size) is required.');
  }
  await assertUniqueAttributes(product.id, attributes);

  const variantCount = await prisma.productVariant.count({ where: { productId: product.id } });
  const generatedSku = sku || `${product.sku}-V${variantCount + 1}`;

  const variant = await prisma.$transaction(async (tx) => {
    const created = await tx.productVariant.create({
      data: {
        productId: product.id,
        sku: generatedSku,
        attributes,
        price,
        compareAtPrice,
        imageUrl,
      },
    });

    if (quantity && warehouseId) {
      const qty = parseInt(quantity, 10);
      await tx.inventory.create({
        data: {
          productId: product.id, variantId: created.id, warehouseId,
          quantityOnHand: qty, accountingOnHand: qty,
        },
      });
      await tx.stockMovement.create({
        data: {
          warehouseId, productId: product.id, variantId: created.id,
          type: 'STOCK_IN', quantity: qty, balanceAfter: qty,
          reason: 'Initial stock on variant creation', performedById: req.user.id,
        },
      });
    }

    return created;
  });

  return success(res, 201, 'Variant created', variant);
});

// PATCH /api/v1/products/:id/variants/:variantId
const updateVariant = asyncHandler(async (req, res) => {
  const existing = await prisma.productVariant.findFirst({
    where: { id: req.params.variantId, productId: req.params.id },
  });
  if (!existing) throw new ApiError(404, 'Variant not found.');

  const allowed = ['attributes', 'sku', 'price', 'compareAtPrice', 'imageUrl', 'isActive'];
  const data = {};
  for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f];

  if (data.attributes) {
    data.attributes = normalizeAttributes(data.attributes);
    if (!Object.keys(data.attributes).length) {
      throw new ApiError(422, 'At least one attribute (e.g. Color, Size) is required.');
    }
    // Exclude this variant itself from the uniqueness check, otherwise
    // saving a variant without changing its attributes would falsely
    // collide with itself.
    await assertUniqueAttributes(existing.productId, data.attributes, existing.id);
  }

  const variant = await prisma.productVariant.update({ where: { id: existing.id }, data });
  return success(res, 200, 'Variant updated', variant);
});

// DELETE /api/v1/products/:id/variants/:variantId
const deleteVariant = asyncHandler(async (req, res) => {
  const existing = await prisma.productVariant.findFirst({
    where: { id: req.params.variantId, productId: req.params.id },
  });
  if (!existing) throw new ApiError(404, 'Variant not found.');

  await prisma.productVariant.delete({ where: { id: existing.id } });
  return success(res, 200, 'Variant deleted');
});

module.exports = {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  approveProduct, rejectProduct, uploadImages, deleteImage, bulkAction,
  createVariant, updateVariant, deleteVariant,
  uploadVariantImages, setVariantPrimaryImage, deleteVariantImage,
};
