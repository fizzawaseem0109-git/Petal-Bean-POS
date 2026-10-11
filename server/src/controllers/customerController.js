import { Customer } from '../models/Customer.js';

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listCustomers(req, res) {
  const { search, limit } = req.valid.query;
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
