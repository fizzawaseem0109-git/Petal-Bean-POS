import { Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { createOrder } from '../services/orderService.js';
import { round2 } from '../utils/money.js';
import { can } from '../constants/permissions.js';

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EXPORT_CAP = 10000;

// Cashiers only ever see bills they rang up themselves; admins see everything.
const ownOnly = (req) => !can(req.user.role, 'orders:view:all');

function dateRange(from, to) {
  if (!from && !to) return null;
  return { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
}

export async function create(req, res) {
  const order = await createOrder(req.valid.body, req.user);
  res.status(201).json({ data: order });
}

export async function list(req, res) {
  const { page, limit, all, search, method, from, to } = req.valid.query;
    if (all && ownOnly(req)) throw ApiError.forbidden('Only an admin can export all bills.');
  const filter = {};
  if (ownOnly(req)) filter.cashier = req.user.email;
  if (method) filter.method = method;
  const range = dateRange(from, to);
  if (range) filter.date = range;
  if (search) {
    const rx = { $regex: escapeRx(search), $options: 'i' };
    filter.$or = [{ billNo: rx }, { 'customer.name': rx }, { 'customer.phone': rx }];
  }

  const total = await Order.countDocuments(filter);
  let query = Order.find(filter).sort({ date: -1, _id: -1 });
  query = all ? query.limit(EXPORT_CAP) : query.skip((page - 1) * limit).limit(limit);
  const data = await query;
  res.json({ data, total, page: all ? 1 : page, pages: all ? 1 : Math.max(1, Math.ceil(total / limit)) });
}

export async function getOne(req, res) {
  const order = await Order.findById(req.valid.params.id);
    if (!order || (ownOnly(req) && order.cashier !== req.user.email)) throw ApiError.notFound('Bill not found.');
  res.json({ data: order });
}

// Sales history header tiles: Bills / Total sales / Cash / Card
export async function summary(req, res) {
  const { from, to } = req.valid.query;
  const range = dateRange(from, to);
  const match = range ? { date: range } : {};
    if (ownOnly(req)) match.cashier = req.user.email;
  const [rows, cashBills, cardBills] = await Promise.all([
    Order.aggregate([{ $match: match }, { $group: { _id: '$method', total: { $sum: '$total' } } }]),
    Order.countDocuments({ ...match, method: 'Cash' }),
    Order.countDocuments({ ...match, method: 'Card' }),
  ]);
  const sum = (m) => rows.find((r) => r._id === m)?.total ?? 0;
  res.json({
    bills: cashBills + cardBills,
    revenue: round2(sum('Cash') + sum('Card')),
    cash: round2(sum('Cash')),
    card: round2(sum('Card')),
  });
}
