import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { nextBillNo } from '../models/Counter.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { reserveStock, releaseStock, logSaleMovements } from './inventoryService.js';
import { recordVisit } from './customerService.js';

/**
 * Turn a cart into a saved bill.
 * The client only sends WHAT was bought (product ids + quantities) and how it
 * was paid. Prices, subtotal, tax and total are always recalculated here from
 * the database, so they can't be tampered with from the browser.
 */
export async function createOrder({ customer, items, payment }, user) {
  // 1. Merge duplicate lines, keep cart order
  const wanted = new Map();
  for (const it of items) wanted.set(it.productId, (wanted.get(it.productId) || 0) + it.qty);
  const ids = [...wanted.keys()];

  // 2. Load the real products
  const products = await Product.find({ _id: { $in: ids }, active: true });
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw ApiError.badRequest('A product in this bill is no longer on the menu. Refresh and try again.');

  const lines = ids.map((id) => {
    const p = byId.get(id);
    const qty = wanted.get(id);
    return { product: p._id, name: p.name, price: p.price, qty, amount: round2(p.price * qty), track: p.trackStock };
  });

  // 3. Totals (same maths as the original app)
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const tax = round2(subtotal * env.shop.taxRate);
  const total = round2(subtotal + tax);

  // 4. Payment checks
  let cashReceived = null;
  let change = null;
  let cardLast4 = null;
  if (payment.method === 'Cash') {
    cashReceived = payment.cashReceived ?? total; // blank = exact amount, as before
    if (cashReceived < total) throw ApiError.badRequest(`Cash received must be at least ${env.shop.currency} ${total}.`);
    change = round2(cashReceived - total);
  } else {
    cardLast4 = payment.cardLast4 || null;
  }

  // 5. Take stock, then save. Undo the stock if anything below fails.
  const reserved = await reserveStock(lines);
  let order;
  try {
    const billNo = await nextBillNo();
    order = await Order.create({
      billNo,
      date: new Date(),
      customer: { name: customer.name, phone: customer.phone },
      items: lines.map(({ product, name, price, qty, amount }) => ({ product, name, price, qty, amount })),
      subtotal,
      taxRate: env.shop.taxRate,
      tax,
      total,
      method: payment.method,
      cashReceived,
      change,
      cardLast4,
      cashier: user?.email || '',
    });
  } catch (err) {
    await releaseStock(reserved);
    throw err;
  }

  // 6. Bookkeeping that must not undo a completed sale if it hiccups
  try {
    const cust = await recordVisit({ name: customer.name, phone: customer.phone, amount: total, date: order.date });
    order.customer.customerId = cust._id;
    await order.save();
    await logSaleMovements(reserved, order.billNo, user?.email || '');
  } catch (err) {
    console.error(`[orders] ${order.billNo} saved, but follow-up bookkeeping failed:`, err);
  }
  return order;
}
