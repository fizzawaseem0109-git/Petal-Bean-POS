// Usage:  npm run seed          → add the login user + any missing products (safe to re-run)
//         npm run seed:reset    → ALSO wipes products, bills, customers and stock history first
import { connectDB, disconnectDB } from '../config/db.js';
import { seedAdmin, seedProducts, resetData } from './seedData.js';

const reset = process.argv.includes('--reset');

try {
  await connectDB();
  if (reset) {
    await resetData();
    console.log('✔ Cleared products, bills, customers, counters and stock history');
  }
  console.log((await seedAdmin()) ? '✔ Created login user' : '• Login user already exists (left unchanged)');
  console.log(`✔ Added ${await seedProducts()} product(s)`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
