import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

function num(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`Environment variable ${name} must be a number (got "${raw}")`);
  return n;
}

const taxRate = num('TAX_RATE', 0.05);
if (taxRate < 0 || taxRate > 1) throw new Error('TAX_RATE must be between 0 and 1 (e.g. 0.05 for 5%)');

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'change-me-in-production') {
  if (isProd) throw new Error('JWT_SECRET must be set to a long random string in production.');
  jwtSecret = 'dev-only-insecure-secret';
  console.warn('[env] JWT_SECRET not set: using an insecure development secret.');
}

export const env = {
  isProd,
  port: num('PORT', 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/petal-and-bean',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  autoSeed: (process.env.AUTO_SEED ?? 'true') !== 'false',
  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || 'Admin',
    email: (process.env.SEED_ADMIN_EMAIL || 'Fizza-waseem@email.com').trim(),
    pin: process.env.SEED_ADMIN_PIN || '2580',
  },
  shop: {
    shopName: process.env.SHOP_NAME || 'Petal & Bean Café',
    shopAddress: process.env.SHOP_ADDRESS || '12 Blossom Street',
    shopPhone: process.env.SHOP_PHONE || '0300 0000000',
    currency: process.env.CURRENCY || 'Rs.',
    taxRate,
  },
};
