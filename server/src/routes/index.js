import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import * as S from '../schemas.js';
import * as auth from '../controllers/authController.js';
import * as staff from '../controllers/staffController.js';
import * as settings from '../controllers/settingsController.js';
import * as products from '../controllers/productController.js';
import * as inventory from '../controllers/inventoryController.js';
import * as customers from '../controllers/customerController.js';
import * as orders from '../controllers/orderController.js';
import * as notifications from '../controllers/notificationController.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

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

  const demoLimiter = limitLogins
  ? rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false })
   : (_req, _res, next) => next();
 r.get('/auth/demo-accounts', demoLimiter, auth.demoAccounts);

  // everything below needs a logged-in user
  r.use(requireAuth);
    const need = requirePermission; // need('permission-name'): see constants/permissions.js

    r.post('/auth/change-pin', validate(S.changePinSchema), auth.changePin);

  r.get('/settings', settings.getSettings);
    r.patch('/settings', need('settings:manage'), validate(S.updateSettingsSchema), settings.updateSettings); // admin only, enforced here on the server

  r.get('/staff', need('staff:manage'), staff.listStaff);
  r.post('/staff', need('staff:manage'), validate(S.createStaffSchema), staff.createStaff);
  r.patch('/staff/:id', need('staff:manage'), validate(S.idParams, 'params'), validate(S.updateStaffSchema), staff.updateStaff);
  r.post('/staff/:id/pin', need('staff:manage'), validate(S.idParams, 'params'), validate(S.resetPinSchema), staff.resetPin);

    // notifications: any logged-in user, but the controller only ever returns / changes the alerts that person may see
  r.get('/notifications', validate(S.listNotificationsQuery, 'query'), notifications.list);
  r.post('/notifications/read-all', notifications.markAllRead);
  r.post('/notifications/clear', notifications.clearAll);
  r.post('/notifications/:id/read', validate(S.idParams, 'params'), notifications.markRead);
  r.delete('/notifications/:id', validate(S.idParams, 'params'), notifications.dismiss);
  
  r.get('/products', validate(S.listProductsQuery, 'query'), products.listProducts);
  r.post('/products', need('products:manage'), validate(S.createProductSchema), products.createProduct);
  r.patch('/products/:id', need('products:manage'), validate(S.idParams, 'params'), validate(S.updateProductSchema), products.updateProduct);
  r.delete('/products/:id', need('products:manage'), validate(S.idParams, 'params'), products.archiveProduct);

  r.get('/inventory', need('inventory:view'), inventory.getInventory);
  r.get('/inventory/movements', need('inventory:view'), validate(S.movementsQuery, 'query'), inventory.listMovements);
  r.post('/inventory/:id/adjust', need('inventory:adjust'), validate(S.idParams, 'params'), validate(S.adjustStockSchema), inventory.adjust);

  r.get('/customers', need('customers:lookup'), validate(S.listCustomersQuery, 'query'), customers.listCustomers);

  r.post('/orders', need('sell'), validate(S.createOrderSchema), orders.create);
  r.get('/orders', need('orders:view:own'), validate(S.listOrdersQuery, 'query'), orders.list);
  r.get('/orders/:id', need('orders:view:own'), validate(S.idParams, 'params'), orders.getOne);
  r.get('/sales/summary', need('orders:view:own'), validate(S.summaryQuery, 'query'), orders.summary);

  // staff performance report: admin only (reports:view is in the admin permission list and not in the cashier one)
 r.get('/reports/staff', need('reports:view'), validate(S.staffReportQuery, 'query'), orders.staffPerformance);
  r.get('/reports/staff/:id/orders', need('reports:view'), validate(S.idParams, 'params'), validate(S.staffSalesQuery, 'query'), orders.staffSales);

  return r;
}
