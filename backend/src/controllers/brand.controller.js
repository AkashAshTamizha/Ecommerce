const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');

const listBrands = asyncHandler(async (req, res) => {
  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
  return success(res, 200, 'Brands fetched', brands);
});

const createBrand = asyncHandler(async (req, res) => {
  const { name, logoUrl } = req.body;
  if (!name) throw new ApiError(400, 'Brand name is required.');

  const existing = await prisma.brand.findUnique({ where: { name } });
  if (existing) throw new ApiError(409, 'A brand with this name already exists.');

  const brand = await prisma.brand.create({ data: { name, logoUrl } });
  return success(res, 201, 'Brand created', brand);
});

const updateBrand = asyncHandler(async (req, res) => {
  const { name, logoUrl, isActive } = req.body;
  const brand = await prisma.brand.update({
    where: { id: req.params.id },
    data: { ...(name && { name }), ...(logoUrl && { logoUrl }), ...(isActive !== undefined && { isActive }) },
  });
  return success(res, 200, 'Brand updated', brand);
});

const deleteBrand = asyncHandler(async (req, res) => {
  const productCount = await prisma.product.count({ where: { brandId: req.params.id } });
  if (productCount > 0) throw new ApiError(409, 'Cannot delete a brand that has products assigned to it.');

  await prisma.brand.delete({ where: { id: req.params.id } });
  return success(res, 200, 'Brand deleted');
});

module.exports = { listBrands, createBrand, updateBrand, deleteBrand };
