/**
 * Parses page/limit/sort query params into Prisma skip/take/orderBy,
 * and builds a consistent `meta` block for list responses.
 *
 * Usage:
 *   const { skip, take, orderBy } = getPagination(req.query, { allowedSort: ['createdAt','name','price'] });
 *   const [items, total] = await Promise.all([
 *     prisma.product.findMany({ where, skip, take, orderBy }),
 *     prisma.product.count({ where }),
 *   ]);
 *   res.json({ success: true, data: items, meta: buildMeta(req.query, total) });
 */

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function getPagination(query, { allowedSort = ['createdAt'], defaultSort = 'createdAt' } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  let limit = parseInt(query.limit, 10) || DEFAULT_LIMIT;
  limit = Math.min(Math.max(limit, 1), MAX_LIMIT);

  const skip = (page - 1) * limit;

  const sortField = allowedSort.includes(query.sortBy) ? query.sortBy : defaultSort;
  const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip,
    take: limit,
    orderBy: { [sortField]: sortDir },
  };
}

function buildMeta({ page, limit }, total) {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = { getPagination, buildMeta };
