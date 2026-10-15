import { Notification } from '../models/Notification.js';
import { Product } from '../models/Product.js';
import { can } from '../constants/permissions.js';

/**
 * Creates alerts and decides who may see them.
 * Every function that CREATES an alert never throws: a failed alert must not undo a sale, a stock change or a staff change.
 */

const emailKey = (user) => String(user?.email || '').trim().toLowerCase();

// Save one alert. If an alert with the same dedupeKey already exists, quietly do nothing (that is how duplicates are blocked).
async function create(fields) {
  try {
    return await Notification.create(fields);
  } catch (err) {
    if (err?.code !== 11000) console.error('[notifications] could not save an alert:', err);
    return null;
  }
}

// Remove the dedupe key from open alerts, so the same alert can be raised again later (e.g. after a restock).
async function rearm(keys) {
  try {
    await Notification.updateMany({ dedupeKey: { $in: keys } }, { $unset: { dedupeKey: '' } });
  } catch (err) {
    console.error('[notifications] could not re-arm stock alerts:', err);
  }
}

/** A bill was completed. Everyone with access sees it: admins always, the cashier who rang it up only for their own. */
export function notifySale(order, shop, user) {
  const who = user?.name || user?.email || 'a cashier';
  return create({
    type: 'sale',
    title: `Sale ${order.billNo} completed`,
    message: `${shop.currency} ${order.total} · ${order.method} · ${order.customer?.name || 'customer'} · by ${who}`,
    audience: 'all',
    owner: user?.email ? emailKey(user) : null,
    ref: order.billNo,
    dedupeKey: `sale:${order.billNo}`,
  });
}

/**
 * Look at these products AFTER their stock changed and raise / re-arm stock alerts:
 *  - out of stock → one "out of stock" alert
 *  - low          → one "low stock" alert (and the old "out" alert is re-armed)
 *  - back to fine → both alerts are re-armed, so a future drop alerts again
 * While a product stays low, no second alert is created.
 */
export async function checkStockAlerts(productIds) {
  try {
    const ids = [...new Set((productIds || []).map(String))];
    if (!ids.length) return;
    const products = await Product.find({ _id: { $in: ids } });
    for (const p of products) {
      const id = String(p._id);
      const lowKey = `stock:${id}:low`;
      const outKey = `stock:${id}:out`;
      const status = p.active ? p.stockStatus : 'ok'; // archived products never alert

      if (status === 'out') {
        await create({
          type: 'out_of_stock', title: `Out of stock: ${p.name}`, message: 'No units left. Restock to keep selling it.',
          audience: 'all', ref: id, dedupeKey: outKey,
        });
      } else if (status === 'low') {
        await rearm([outKey]);
        await create({
          type: 'low_stock', title: `Low stock: ${p.name}`, message: `Only ${p.stock} left (alert level ${p.lowStockAt}).`,
          audience: 'all', ref: id, dedupeKey: lowKey,
        });
      } else {
        await rearm([lowKey, outKey]);
      }
    }
  } catch (err) {
    console.error('[notifications] stock check failed:', err);
  }
}

/** Something happened to a staff account. Admins only. */
export function notifyStaff(title, message, ref = '') {
  return create({ type: 'staff', title, message, audience: 'admin', ref });
}

/**
 * MongoDB filter for "alerts this person is allowed to see and has not cleared".
 *  - anyone allowed to manage staff (admins): everything
 *  - everyone else (cashiers): only alerts for all, that are not tied to someone else
 */
export function visibleTo(user) {
  const base = { dismissedBy: { $ne: String(user._id) } };
  if (can(user.role, 'staff:manage')) return base;
  return { ...base, audience: 'all', $or: [{ owner: null }, { owner: emailKey(user) }] };
}