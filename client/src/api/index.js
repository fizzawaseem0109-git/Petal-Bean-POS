import { http } from './http.js';

export const api = {
  // auth
  login: (email, pin) => http('/auth/login', { method: 'POST', body: { email, pin } }),
  me: () => http('/auth/me'),
  getSettings: () => http('/settings'),

  // products & inventory
  getProducts: (params) => http('/products', { params }),
  createProduct: (body) => http('/products', { method: 'POST', body }),
  updateProduct: (id, body) => http(`/products/${id}`, { method: 'PATCH', body }),
  archiveProduct: (id) => http(`/products/${id}`, { method: 'DELETE' }),
  getInventory: () => http('/inventory'),
  adjustStock: (id, body) => http(`/inventory/${id}/adjust`, { method: 'POST', body }),

  // customers
  getCustomers: (params) => http('/customers', { params }),

  // orders (bills) & sales
  createOrder: (body) => http('/orders', { method: 'POST', body }),
  getOrders: (params) => http('/orders', { params }),
  getSalesSummary: () => http('/sales/summary'),
};
