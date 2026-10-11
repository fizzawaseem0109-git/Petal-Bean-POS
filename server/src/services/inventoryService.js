import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Take stock for every tracked line of a sale, all-or-nothing.
 *
 * Each product is decremented with ONE atomic conditional update
 * ("stock >= qty"), so two cashiers selling the last croissant at the same
 * moment can never push stock below zero. This works on a plain standalone
 * MongoDB (no replica set / transactions needed). If a later line fails,
 * earlier lines are put back.
 */
export async function reserveStock(lines) {
  const reserved = [];
  try {
    for (const line of lines) {
      if (!line.track) continue;
      const updated = await Product.findOneAndUpdate(
        { _id: line.product, active: true, trackStock: true, stock: { $gte: line.qty } },
        { $inc: { stock: -line.qty } },
        { returnDocument: 'after' }
      );
      if (!updated) {
        const fresh = await Product.findById(line.product).select('stock name');
        const left = Math.max(0, fresh?.stock ?? 0);
        throw ApiError.conflict(
          left === 0 ? `"${line.name}" is sold out.` : `Only ${left} of "${line.name}" left in stock.`,
          { productId: String(line.product), available: left }
        );
      }
      reserved.push({ line, balance: updated.stock });
    }
  } catch (err) {
    await releaseStock(reserved);
    throw err;
  }
  return reserved;
}

export async function releaseStock(reserved) {
  await Promise.all(
    reserved.map(({ line }) => Product.updateOne({ _id: line.product }, { $inc: { stock: line.qty } }))
  );
}

export async function logSaleMovements(reserved, billNo, by) {
  if (!reserved.length) return;
  await StockMovement.insertMany(
    reserved.map(({ line, balance }) => ({
      product: line.product,
      productName: line.name,
      delta: -line.qty,
      balance,
      reason: 'sale',
      billNo,
      by,
    }))
  );
}

/** Manual stock change from the Inventory screen: restock (+), correction (+/-) or set an exact count. */
export async function adjustStock(productId, { delta, set, reason, note }, by) {
  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound('Product not found.');

  let change = delta;
  if (set !== undefined) change = set - product.stock; // "I counted 12 on the shelf"
  if (!change) return { product, movement: null };

  // For removals, only apply if enough stock is still there (atomic).
  const filter = change < 0 ? { _id: productId, stock: { $gte: -change } } : { _id: productId };
  const updated = await Product.findOneAndUpdate(filter, { $inc: { stock: change } }, { returnDocument: 'after' });
  if (!updated) throw ApiError.conflict('Stock changed while you were editing. Reload and try again.');

  const movement = await StockMovement.create({
    product: updated._id,
    productName: updated.name,
    delta: change,
    balance: updated.stock,
    reason: reason || (change > 0 ? 'restock' : 'adjustment'),
    note: note || '',
    by,
  });
  return { product: updated, movement };
}
