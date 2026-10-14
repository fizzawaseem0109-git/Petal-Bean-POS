import { Customer } from '../models/Customer.js';
import { can } from '../constants/permissions.js';
import { ApiError } from '../utils/ApiError.js';

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listCustomers(req, res) {
    let { search, limit } = req.valid.query;
  if (!can(req.user.role, 'customers:view:all')) {
    // Cashiers can look up a returning customer at checkout, but can't browse or export the whole list.
    if (!search || search.length < 2) throw ApiError.badRequest('Type at least 2 letters or digits to search customers.');
    limit = Math.min(limit, 10);
  }
  const filter = {};
  if (search) {
    const rx = { $regex: escapeRx(search), $options: 'i' };
    filter.$or = [{ name: rx }, { phone: rx }];
  }
  const [data, total] = await Promise.all([
    Customer.find(filter).sort({ lastVisit: -1, _id: -1 }).limit(limit),
    Customer.countDocuments(filter),
  ]);
  res.json({ data, total });
}
