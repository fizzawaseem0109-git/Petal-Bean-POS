import { z } from 'zod';
import { CATEGORY_IDS } from './constants/categories.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const trimmed = (label, max = 80) => z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max);
const flag = z.enum(['1', 'true', '0', 'false']).transform((v) => v === '1' || v === 'true');

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email first.'),
  pin: z.string().regex(/^\d{4,6}$/, 'Enter your PIN (4 to 6 digits).'),
});

// ---- staff & PINs
const PIN_ERR = 'PIN must be 4 to 6 digits.';
const isEasyPin = (p) => {
  if (/^(\d)\1+$/.test(p)) return true; // 1111, 000000
  const d = [...p].map(Number);
  const step = d[1] - d[0];
  if ((step === 1 || step === -1) && d.every((x, i) => i === 0 || x - d[i - 1] === step)) return true; // 1234, 4321
  return ['2580', '0852'].includes(p); // straight down the keypad (and the old default PIN)
};
export const newPin = z
  .string({ error: PIN_ERR })
  .regex(/^\d{4,6}$/, PIN_ERR)
  .refine((p) => !isEasyPin(p), 'That PIN is too easy to guess. Avoid repeated or sequential digits (like 1111 or 1234).');

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
  currentPin: z.string({ error: 'Enter your current PIN.' }).regex(/^\d{4,6}$/, 'Enter your current PIN.'),
  newPin,
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
