const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, success } = require('../utils/apiResponse');
const { slugify } = require('../utils/slug');

const listCategories = asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { _count: { select: { products: true, children: true } } },
    orderBy: { name: 'asc' },
  });
  return success(res, 200, 'Categories fetched', categories);
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, parentId } = req.body;
  if (!name) throw new ApiError(400, 'Category name is required.');

  const category = await prisma.category.create({
    data: { name, slug: slugify(name) + '-' + Date.now().toString(36), parentId: parentId || null },
  });
  return success(res, 201, 'Category created', category);
});

const updateCategory = asyncHandler(async (req, res) => {
  const { name, isActive } = req.body;
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: { ...(name && { name }), ...(isActive !== undefined && { isActive }) },
  });
  return success(res, 200, 'Category updated', category);
});

const deleteCategory = asyncHandler(async (req, res) => {
  const productCount = await prisma.product.count({ where: { categoryId: req.params.id } });
  if (productCount > 0) throw new ApiError(409, 'Cannot delete a category that has products assigned to it.');

  await prisma.category.delete({ where: { id: req.params.id } });
  return success(res, 200, 'Category deleted');
});

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
