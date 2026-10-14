// One place that says what each role may do. Routes ask for a permission, never for a role name,
// so changing what cashiers can do later means editing this list only.
export const ALL_PERMISSIONS = [
  'sell',               // create bills, use the menu
  'orders:view:own',    // see bills this person rang up (and reprint their receipts)
  'orders:view:all',    // see every bill, export sales
  'customers:lookup',   // search a returning customer at checkout (max 10 results)
  'customers:view:all', // browse / export the whole customer list
  'inventory:view',     // Inventory screen + stock history
  'inventory:adjust',   // restock / correct stock
  'products:manage',    // add / edit / remove products
  // reserved for the next steps (nothing uses these yet)
  'staff:manage',
  'logs:view',
  'reports:view',
  'refunds:issue',
  'settings:manage',
];

const ROLE_PERMISSIONS = {
  admin: new Set(ALL_PERMISSIONS),
  cashier: new Set(['sell', 'orders:view:own', 'customers:lookup']),
};

export const permissionsFor = (role) => [...(ROLE_PERMISSIONS[role] || [])];
export const can = (role, permission) => ROLE_PERMISSIONS[role]?.has(permission) ?? false;