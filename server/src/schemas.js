import { z } from 'zod';
import { CATEGORY_IDS } from './constants/categories.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const trimmed = (label, max = 80) => z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max);
const flag = z.enum(['1', 'true', '0', 'false']).transform((v) => v === '1' || v === 'true');

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email first.'),
    pin: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.').max(72, 'Enter your password.'), // field is still named "pin" in the API; it now carries a password (old PINs keep working until changed)
});

// ---- staff & passwords (API fields stay named pin / currentPin / newPin; they now carry passwords)
const PASSWORD_ERR = 'Password must be 8 to 72 characters.';
const COMMON = new Set(['password', 'password1', 'password123', 'qwertyui', 'qwerty123', '12345678', '123456789', '1234567890', 'iloveyou', 'admin123', 'welcome1', 'letmein1', 'cafe1234']);
const isEasyPassword = (p) => {
  const s = p.toLowerCase();
  if (COMMON.has(s)) return true;
  if (/^(.)\1+$/.test(s)) return true; // aaaaaaaa, 11111111
  const codes = [...s].map((c) => c.charCodeAt(0));
  const step = codes[1] - codes[0];
  return (step === 1 || step === -1) && codes.every((c, i) => i === 0 || c - codes[i - 1] === step); // abcdefgh, 87654321
};
export const newPin = z
  .string({ error: PASSWORD_ERR })
  .min(8, PASSWORD_ERR)
  .max(72, PASSWORD_ERR) // bcrypt only uses the first 72 bytes
  .refine((p) => !isEasyPassword(p), 'That password is too easy to guess. Avoid common passwords and repeated or sequential characters.');


const staffRole = z.enum(['admin', 'cashier']);
export const createStaffSchema = z.object({
  name: trimmed('Name', 60),
  email: z.string({ error: 'Email is required.' }).trim().max(120).email('Enter a valid email address.'),
  role: staffRole.default('cashier'),
  pin: newPin,
});
export const updateStaffSchema = z
  .object({ name: trimmed('Name', 60).optional(), role: staffRole.optional(), active: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');
export const resetPinSchema = z.object({ pin: newPin });
export const changePinSchema = z.object({
  currentPin: z.string({ error: 'Enter your current password.' }).min(1, 'Enter your current password.').max(72, 'Enter your current password.'),  newPin,
});

const phone = z
  .string({ error: 'Enter a valid phone number (7–15 digits).' })
  .trim()
  .refine((v) => {
    const d = v.replace(/\D/g, '').length;
    return d >= 7 && d <= 15;
  }, 'Enter a valid phone number (7–15 digits).')
  .refine((v) => v.length <= 30, 'Phone number is too long.');

export const createOrderSchema = z.object({
  customer: z.object({ name: trimmed("The customer's name"), phone }),
  items: z
    .array(z.object({ productId: objectId, qty: z.number().int().min(1).max(999) }))
    .min(1, 'The bill is empty.')
    .max(100),
  payment: z.discriminatedUnion('method', [
    z.object({
      method: z.literal('Cash'),
      cashReceived: z.number().min(0).max(100000000).nullish(),
    }),
    z.object({
      method: z.literal('Card'),
      cardLast4: z
        .string()
        .trim()
        .regex(/^(\d{4})?$/, 'Card digits must be exactly 4 numbers, or leave it empty.')
        .nullish(),
    }),
  ]),
});

export const listOrdersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  all: flag.optional(), // exports: everything (capped at 10,000)
  search: z.string().trim().max(80).optional(),
  method: z.enum(['Cash', 'Card']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const summaryQuery = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

 
// ---- staff performance report (admin only)
const fromBeforeTo = [(q) => !q.from || !q.to || q.from <= q.to, 'The start date must be on or before the end date.'];
export const staffReportQuery = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).refine(...fromBeforeTo);
export const staffSalesQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine(...fromBeforeTo);


export const listCustomersQuery = z.object({
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

export const listProductsQuery = z.object({
  category: z.enum(CATEGORY_IDS).optional(),
  search: z.string().trim().max(80).optional(),
  includeInactive: flag.optional(),
});

const productFields = {
  name: trimmed('Name'),
  price: z.number({ error: 'Price must be a number.' }).min(0, 'Price cannot be negative.').max(10000000),
  category: z.enum(CATEGORY_IDS, { error: 'Pick a category.' }),
  icon: z.string().trim().max(16).optional(),
  stock: z.number().int('Stock must be a whole number.').min(0, 'Stock cannot be negative.').max(1000000),
  lowStockAt: z.number().int().min(0).max(1000000),
  trackStock: z.boolean(),
  active: z.boolean(),
};
export const createProductSchema = z.object({
  ...productFields,
  stock: productFields.stock.default(0),
  lowStockAt: productFields.lowStockAt.default(5),
  trackStock: productFields.trackStock.default(true),
  active: productFields.active.default(true),
});
// stock is changed through /inventory/:id/adjust (so it's always logged), not by editing the product
export const updateProductSchema = z
  .object({ ...productFields })
  .omit({ stock: true })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update.');

  // ---- café settings (admin only). Send only the fields you want to change.
// taxRate is a fraction like the rest of the app: 0.05 = 5 %. The settings screen converts from/to percent.
export const updateSettingsSchema = z
  .object({
    shopName: trimmed('Café name', 60).optional(),
    shopAddress: z.string().trim().max(120, 'Address is too long (120 characters max).').optional(),
    shopPhone: z.string().trim().max(30, 'Phone number is too long.').optional(),
    currency: trimmed('Currency', 8).optional(),
    taxRate: z
      .number({ error: 'Tax must be a number.' })
      .min(0, 'Tax cannot be negative.')
      .max(1, 'Tax cannot be more than 100%.')
      .transform((v) => Math.round(v * 10000) / 10000) // at most 2 decimals of a percent (8.25 %)
      .optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update.');
export const idParams = z.object({ id: objectId });

export const adjustStockSchema = z
  .object({
    delta: z.number().int('Use a whole number.').min(-1000000).max(1000000).optional(),
    set: z.number().int('Use a whole number.').min(0).max(1000000).optional(),
    reason: z.enum(['restock', 'adjustment']).optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine((o) => (o.delta === undefined) !== (o.set === undefined), 'Send either "delta" or "set".');

export const movementsQuery = z.object({
  productId: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const listNotificationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});