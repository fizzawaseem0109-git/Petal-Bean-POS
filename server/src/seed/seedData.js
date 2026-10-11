import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { Customer } from '../models/Customer.js';
import { Counter } from '../models/Counter.js';
import { StockMovement } from '../models/StockMovement.js';
import { PRODUCTS } from './products.js';

/** Create the login user if it doesn't exist yet. Never overwrites an existing PIN. */
export async function seedAdmin() {
  const { email, name, pin } = env.seedAdmin;
  if (await User.exists({ emailKey: email.toLowerCase() })) return false;
  await User.create({ email, name, role: 'admin', pinHash: await User.hashPin(pin) });
  return true;
}

/** Insert any of the original products that are missing. Existing products (and their stock) are left alone. */
export async function seedProducts() {
  let added = 0;
  for (const p of PRODUCTS) {
    const nameKey = p.name.toLowerCase();
    if (await Product.exists({ nameKey })) continue;
    const doc = await Product.create(p);
    await StockMovement.create({
      product: doc._id, productName: doc.name, delta: doc.stock, balance: doc.stock, reason: 'initial', by: 'seed',
    });
    added++;
  }
  return added;
}

/** Wipe all business data (NOT users) and start fresh. */
export async function resetData() {
  await Promise.all([Order.deleteMany({}), Customer.deleteMany({}), Counter.deleteMany({}), StockMovement.deleteMany({}), Product.deleteMany({})]);
}

/** Called on server start: makes a brand-new database usable without any manual step. */
export async function ensureSeed() {
  const admin = await seedAdmin();
  const products = (await Product.estimatedDocumentCount()) === 0 ? await seedProducts() : 0;
  if (admin) console.log(`[seed] created login ${env.seedAdmin.email} (PIN from SEED_ADMIN_PIN)`);
  if (products) console.log(`[seed] added ${products} products`);
}
