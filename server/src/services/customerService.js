import { Customer } from '../models/Customer.js';
import { phoneKey } from '../utils/phone.js';

/**
 * Create the customer on their first bill, otherwise bump orders / total spent.
 * Matches by phone digits, like the original app. Same name update behaviour too:
 * the latest name typed wins, the first phone formatting is kept.
 */
export async function recordVisit({ name, phone, amount, date }) {
  const key = phoneKey(phone);
  const run = () =>
    Customer.findOneAndUpdate(
      { phoneKey: key },
      {
        $set: { name, lastVisit: date },
        $inc: { orders: 1, totalSpent: amount },
        $setOnInsert: { phone, phoneKey: key },
      },
      { upsert: true, returnDocument: 'after' }
    );
  try {
    return await run();
  } catch (err) {
    if (err?.code !== 11000) throw err; // two bills for a brand-new customer at the same instant: retry as an update
    return run();
  }
}
