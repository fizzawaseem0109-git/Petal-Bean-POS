import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
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


// ---------------------------------------------------------------------------
// Staff performance (admin only: the routes require the 'reports:view' permission).
// A sale belongs to the staff member whose login created it: createOrder() stamps order.cashier from the
// authenticated token's user (never from the request body), and a staff email can't be changed afterwards.
// The app has no refund / cancel feature yet, so every saved bill is a completed sale. When one is added,
// exclude those bills here and both endpoints (and their totals) follow.
const COMPLETED = {};
const sameEmail = (email) => ({ $regex: `^${escapeRx(String(email).trim())}$`, $options: 'i' });
const staffCard = (u) => ({ id: String(u._id), name: u.name || '', email: u.email, role: u.role, active: u.active !== false });

export async function staffPerformance(req, res) {
 const { from, to } = req.valid.query;
  const range = dateRange(from, to);
  const match = { ...COMPLETED, ...(range ? { date: range } : {}) };

  const [rows, users, distinctCustomers] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
       $group: {
          _id: { $toLower: { $ifNull: ['$cashier', ''] } },
          bills: { $sum: 1 },
          sales: { $sum: '$total' },
          lastSale: { $max: '$date' },
          customerIds: { $addToSet: '$customer.customerId' },
          unlinked: { $sum: { $cond: [{ $eq: [{ $type: '$customer.customerId' }, 'objectId'] }, 0, 1] } },
        },
      },
   ]),
   User.find().select('name email emailKey role active'),
    Order.distinct('customer.customerId', match),
  ]);

 const statsFor = (r) => {
   const bills = r?.bills ?? 0;
    const unlinked = r?.unlinked ?? 0;
    const linked = (r?.customerIds ?? []).filter(Boolean).length;
    return {
      bills,
      sales: round2(r?.sales ?? 0),
      lastSale: r?.lastSale ?? null,
      // Distinct customers is only reported when the bills carry a customer link (customerId).
      customers: bills > 0 && unlinked === bills ? null : linked,
      customersPartial: unlinked > 0 && unlinked < bills, // some bills had no customer link, so the count may be low
    };
  };

  const byKey = new Map(rows.map((r) => [r._id, r]));
  const data = users.map((u) => ({ ...staffCard(u), ...statsFor(byKey.get(u.emailKey)) }));
  const known = new Set(users.map((u) => u.emailKey));
  for (const r of rows) {
    if (!known.has(r._id)) data.push({ id: null, name: r._id ? '' : 'No staff recorded', email: r._id, role: null, active: false, ...statsFor(r) });
  }
  data.sort((a, b) => b.sales - a.sales || b.bills - a.bills || (a.name || a.email).localeCompare(b.name || b.email));

  const bills = rows.reduce((s, r) => s + r.bills, 0);
  const unlinkedBills = rows.reduce((s, r) => s + r.unlinked, 0);
  res.json({
    data,
    totals: {
      bills,
      sales: round2(rows.reduce((s, r) => s + r.sales, 0)),
      customers: bills > 0 && unlinkedBills === bills ? null : distinctCustomers.filter(Boolean).length, // shop-wide distinct
      customersPartial: unlinkedBills > 0 && unlinkedBills < bills,
    },
  });
}

export async function staffSales(req, res) {
  const { id } = req.valid.params;
  const { page, limit, from, to } = req.valid.query;
  const user = await User.findById(id).select('name email emailKey role active');
  if (!user) throw ApiError.notFound('Staff member not found.');

  const filter = { ...COMPLETED, cashier: sameEmail(user.email) };
  const range = dateRange(from, to);
  if (range) filter.date = range;

  const [total, data, sums] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Order.aggregate([{ $match: filter }, { $group: { _id: null, sales: { $sum: '$total' } } }]),
  ]);
  res.json({ staff: staffCard(user), data, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: { bills: total, sales: round2(sums[0]?.sales ?? 0) } });
}