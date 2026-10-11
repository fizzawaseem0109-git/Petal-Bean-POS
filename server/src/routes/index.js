import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as S from '../schemas.js';
import * as auth from '../controllers/authController.js';
import * as settings from '../controllers/settingsController.js';
import * as products from '../controllers/productController.js';
import * as inventory from '../controllers/inventoryController.js';
import * as customers from '../controllers/customerController.js';
import * as orders from '../controllers/orderController.js';

export function buildRouter({ limitLogins = true } = {}) {
  const r = Router();

  r.get('/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

  // --- auth (per-account lockout lives in the controller; this is the per-IP safety net)
  const loginLimiter = limitLogins
    ? rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false,
        message: { message: 'Too many login attempts from this device. Please wait a few minutes.' } })
    : (_req, _res, next) => next();
  r.post('/auth/login', loginLimiter, validate(S.loginSchema), auth.login);
  r.get('/auth/me', requireAuth, auth.me);

  // everything below needs a logged-in user
  r.use(requireAuth);
  const admin = requireRole('admin');

  r.get('/settings', settings.getSettings);

  r.get('/products', validate(S.listProductsQuery, 'query'), products.listProducts);
  r.post('/products', admin, validate(S.createProductSchema), products.createProduct);
  r.patch('/products/:id', admin, validate(S.idParams, 'params'), validate(S.updateProductSchema), products.updateProduct);
  r.delete('/products/:id', admin, validate(S.idParams, 'params'), products.archiveProduct);

  r.get('/inventory', inventory.getInventory);
  r.get('/inventory/movements', validate(S.movementsQuery, 'query'), inventory.listMovements);
  r.post('/inventory/:id/adjust', admin, validate(S.idParams, 'params'), validate(S.adjustStockSchema), inventory.adjust);

  r.get('/customers', validate(S.listCustomersQuery, 'query'), customers.listCustomers);

  r.post('/orders', validate(S.createOrderSchema), orders.create);
  r.get('/orders', validate(S.listOrdersQuery, 'query'), orders.list);
  r.get('/orders/:id', validate(S.idParams, 'params'), orders.getOne);
  r.get('/sales/summary', validate(S.summaryQuery, 'query'), orders.summary);

  return r;
}
