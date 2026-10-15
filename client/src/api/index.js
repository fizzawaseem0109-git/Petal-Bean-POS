import { http } from './http.js';

export const api = {
  // auth
  login: (email, pin) => http('/auth/login', { method: 'POST', body: { email, pin } }),
  me: () => http('/auth/me'),
   getDemoAccounts: () => http('/auth/demo-accounts'), // [] unless DEMO_LOGIN=true on the server
  changePin: (currentPin, newPin) => http('/auth/change-pin', { method: 'POST', body: { currentPin, newPin } }),   
  getSettings: () => http('/settings'),
  updateSettings: (body) => http('/settings', { method: 'PATCH', body }), // admin only (server enforces settings:manage)

  // products & inventory
  getProducts: (params) => http('/products', { params }),
  createProduct: (body) => http('/products', { method: 'POST', body }),
  updateProduct: (id, body) => http(`/products/${id}`, { method: 'PATCH', body }),
  archiveProduct: (id) => http(`/products/${id}`, { method: 'DELETE' }),
  getInventory: () => http('/inventory'),
  adjustStock: (id, body) => http(`/inventory/${id}/adjust`, { method: 'POST', body }),

  // customers
  getCustomers: (params) => http('/customers', { params }),

  // staff (admin only; the server enforces this with the staff:manage permission)
  getStaff: () => http('/staff'),
  createStaff: (body) => http('/staff', { method: 'POST', body }),
  updateStaff: (id, body) => http(`/staff/${id}`, { method: 'PATCH', body }),
  resetStaffPin: (id, pin) => http(`/staff/${id}/pin`, { method: 'POST', body: { pin } }),


  // notifications (the server only ever returns the alerts this person is allowed to see)
  getNotifications: (params) => http('/notifications', { params }),
  markNotificationRead: (id) => http(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => http('/notifications/read-all', { method: 'POST' }),
  dismissNotification: (id) => http(`/notifications/${id}`, { method: 'DELETE' }),
  clearNotifications: () => http('/notifications/clear', { method: 'POST' }),

  // orders (bills) & sales
  createOrder: (body) => http('/orders', { method: 'POST', body }),
  getOrders: (params) => http('/orders', { params }),
  getSalesSummary: () => http('/sales/summary'),


  // staff performance report (admin only; the server enforces reports:view)
  getStaffReport: (params) => http('/reports/staff', { params }),
  getStaffSales: (id, params) => http(`/reports/staff/${id}/orders`, { params }),
 };

