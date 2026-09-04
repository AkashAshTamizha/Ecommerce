const prisma = require('../config/db');
const { ApiError } = require('../utils/apiResponse');
const { createNotification } = require('./notification.service');

/**
 * Recomputes a product's status from the *sum* of all its inventory rows
 * (every warehouse, every variant) — never from a single row in isolation.
 * A product with 5 variants across 3 warehouses shouldn't flip to
 * OUT_OF_STOCK just because one (variant, warehouse) combination hit zero.
 * Only ever touches ACTIVE / LOW_STOCK / OUT_OF_STOCK — DRAFT/INACTIVE
 * products are left alone (a seller/admin controls those explicitly).
 */
async function recalcProductStatus(tx, productId) {
  const [product, rows] = await Promise.all([
    tx.product.findUnique({ where: { id: productId } }),
    tx.inventory.findMany({ where: { productId }, select: { quantityOnHand: true, quantityReserved: true } }),
  ]);
  if (!product) return null;
  if (!['ACTIVE', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(product.status)) return product;

  const totalAvailable = rows.reduce((sum, r) => sum + (r.quantityOnHand - r.quantityReserved), 0);

  let newStatus = product.status;
  if (totalAvailable <= 0) newStatus = 'OUT_OF_STOCK';
  else if (totalAvailable <= product.minStockLevel) newStatus = 'LOW_STOCK';
  else newStatus = 'ACTIVE';

  if (newStatus === product.status) return product;
  return tx.product.update({ where: { id: productId }, data: { status: newStatus } });
}

/**
 * Applies a PHYSICAL stock movement transactionally: upserts the Inventory
 * row and writes an immutable StockMovement ledger entry in the same DB
 * transaction. This changes `quantityOnHand` — the count physically sitting
 * in the warehouse. Use this for STOCK_IN, STOCK_OUT, ADJUSTMENT, TRANSFER,
 * DAMAGED and RETURN_RESTOCK.
 *
 * Do NOT use this for order reservations — see reserveStock/releaseReservation/
 * fulfillReservation below, which move `quantityReserved` instead and leave
 * the physical count untouched until the order actually ships.
 *
 * @param {Object} params
 * @param {string} params.productId
 * @param {string} [params.variantId]
 * @param {string} params.warehouseId
 * @param {number} params.quantity - signed delta (+in / -out)
 * @param {'STOCK_IN'|'STOCK_OUT'|'TRANSFER'|'ADJUSTMENT'|'RETURN_RESTOCK'|'DAMAGED'} params.type
 * @param {string} [params.reference]
 * @param {string} [params.reason]
 * @param {string} [params.performedById]
 */
async function applyStockMovement({
  productId, variantId, warehouseId, quantity, type, reference, reason, performedById,
}) {
  if (!quantity || quantity === 0) throw new ApiError(400, 'Movement quantity must be non-zero.');
  if (['ORDER_RESERVED', 'ORDER_RELEASED'].includes(type)) {
    throw new ApiError(500, 'Use reserveStock/releaseReservation for reservation movements, not applyStockMovement.');
  }

  return prisma.$transaction(async (tx) => {
    // NOTE: variantId is nullable, and Prisma's generated compound-unique
    // lookup (productId_variantId_warehouseId) rejects `null` as a value
    // ("Argument variantId must not be null"), even though the column is
    // nullable — this is a known Prisma limitation with nullable fields
    // inside @@unique indexes. We use findFirst instead of findUnique here.
    let inventory = await tx.inventory.findFirst({
      where: { productId, variantId: variantId || null, warehouseId },
    });

    if (!inventory) {
      if (quantity < 0) {
        throw new ApiError(400, 'Cannot remove stock from a warehouse with no existing inventory record.');
      }
      inventory = await tx.inventory.create({
        data: { productId, variantId, warehouseId, quantityOnHand: 0 },
      });
    }

    const newQty = inventory.quantityOnHand + quantity;
    if (newQty < 0) {
      throw new ApiError(400, `Insufficient stock: available ${inventory.quantityOnHand}, requested ${Math.abs(quantity)}.`);
    }

    // ADJUSTMENT is specifically for correcting the *physical* count after a
    // recount (shrinkage, damage found, miscount, etc). Only that movement
    // type is allowed to make physical and accounting stock diverge — every
    // other movement type represents an agreed change and keeps both in sync.
    const accountingDelta = type === 'ADJUSTMENT' ? 0 : quantity;
    const newAccountingQty = Math.max(0, inventory.accountingOnHand + accountingDelta);

    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantityOnHand: newQty, accountingOnHand: newAccountingQty },
    });

    const movement = await tx.stockMovement.create({
      data: {
        warehouseId, productId, variantId, type, quantity,
        balanceAfter: newQty, reference, reason, performedById,
      },
    });

    const product = await recalcProductStatus(tx, productId);

    return { inventory: updated, movement, product };
  });
}

/**
 * Reserves stock for a newly placed order line. Moves `quantityReserved`
 * up by `quantity` — the physical count (`quantityOnHand`) does NOT change,
 * because the item hasn't left the warehouse yet, it's just been claimed by
 * this order. Fails if there isn't enough *available* (onHand - reserved)
 * stock to cover the reservation.
 */
async function reserveStock({ productId, variantId, warehouseId, quantity, reference, performedById }) {
  const qty = Math.abs(quantity);
  if (!qty) throw new ApiError(400, 'Reservation quantity must be non-zero.');

  return prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findFirst({ where: { productId, variantId: variantId || null, warehouseId } });
    if (!inventory) throw new ApiError(400, 'No inventory record for this product/warehouse.');

    const available = inventory.quantityOnHand - inventory.quantityReserved;
    if (available < qty) {
      throw new ApiError(400, `Insufficient stock: available ${available}, requested ${qty}.`);
    }

    const newReserved = inventory.quantityReserved + qty;
    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantityReserved: newReserved, accountingReserved: inventory.accountingReserved + qty },
    });

    const movement = await tx.stockMovement.create({
      data: {
        warehouseId, productId, variantId, type: 'ORDER_RESERVED', quantity: qty,
        balanceAfter: inventory.quantityOnHand - newReserved, // resulting available stock
        reference, reason: 'Stock reserved for order', performedById,
      },
    });

    const product = await recalcProductStatus(tx, productId);
    return { inventory: updated, movement, product };
  });
}

/**
 * Releases a reservation WITHOUT the order ever having shipped — e.g. the
 * order was cancelled while still PENDING/CONFIRMED/PACKED. Moves
 * `quantityReserved` back down; `quantityOnHand` is untouched because the
 * stock never physically left the warehouse.
 */
async function releaseReservation({ productId, variantId, warehouseId, quantity, reference, performedById, reason }) {
  const qty = Math.abs(quantity);
  if (!qty) throw new ApiError(400, 'Release quantity must be non-zero.');

  return prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findFirst({ where: { productId, variantId: variantId || null, warehouseId } });
    if (!inventory) throw new ApiError(400, 'No inventory record for this product/warehouse.');

    const newReserved = Math.max(0, inventory.quantityReserved - qty);
    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantityReserved: newReserved, accountingReserved: Math.max(0, inventory.accountingReserved - qty) },
    });

    const movement = await tx.stockMovement.create({
      data: {
        warehouseId, productId, variantId, type: 'ORDER_RELEASED', quantity: qty,
        balanceAfter: inventory.quantityOnHand - newReserved,
        reference, reason: reason || 'Reservation released', performedById,
      },
    });

    const product = await recalcProductStatus(tx, productId);
    return { inventory: updated, movement, product };
  });
}

/**
 * Converts a reservation into an actual physical stock removal — call this
 * when the order actually ships (stock leaves the warehouse). Decrements
 * BOTH `quantityOnHand` and `quantityReserved` by the same amount, so
 * available stock (onHand - reserved) is unchanged by this step, but the
 * physical count now correctly reflects that the item is gone.
 */
async function fulfillReservation({ productId, variantId, warehouseId, quantity, reference, performedById }) {
  const qty = Math.abs(quantity);
  if (!qty) throw new ApiError(400, 'Fulfillment quantity must be non-zero.');

  return prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findFirst({ where: { productId, variantId: variantId || null, warehouseId } });
    if (!inventory) throw new ApiError(400, 'No inventory record for this product/warehouse.');

    const newOnHand = Math.max(0, inventory.quantityOnHand - qty);
    const newReserved = Math.max(0, inventory.quantityReserved - qty);

    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        quantityOnHand: newOnHand,
        quantityReserved: newReserved,
        accountingOnHand: Math.max(0, inventory.accountingOnHand - qty),
        accountingReserved: Math.max(0, inventory.accountingReserved - qty),
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        warehouseId, productId, variantId, type: 'STOCK_OUT', quantity: -qty,
        balanceAfter: newOnHand,
        reference, reason: 'Order shipped — reservation fulfilled', performedById,
      },
    });

    const product = await recalcProductStatus(tx, productId);
    return { inventory: updated, movement, product };
  });
}

/** Transfers stock between two warehouses as a paired OUT + IN movement. */
async function transferStock({ productId, variantId, fromWarehouseId, toWarehouseId, quantity, performedById, reference }) {
  if (fromWarehouseId === toWarehouseId) throw new ApiError(400, 'Source and destination warehouse must differ.');

  await applyStockMovement({
    productId, variantId, warehouseId: fromWarehouseId, quantity: -Math.abs(quantity),
    type: 'TRANSFER', reference, reason: `Transfer to warehouse ${toWarehouseId}`, performedById,
  });

  return applyStockMovement({
    productId, variantId, warehouseId: toWarehouseId, quantity: Math.abs(quantity),
    type: 'TRANSFER', reference, reason: `Transfer from warehouse ${fromWarehouseId}`, performedById,
  });
}

module.exports = {
  applyStockMovement, transferStock, recalcProductStatus,
  reserveStock, releaseReservation, fulfillReservation,
};
