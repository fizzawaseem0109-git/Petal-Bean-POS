// Run with:  npm test      (needs a MongoDB reachable at TEST_MONGODB_URI)
// Uses a separate database whose name must contain "test": it is wiped before the run.
import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.SEED_ADMIN_EMAIL = 'Fizza-waseem@email.com';
process.env.SEED_ADMIN_PIN = '2580';

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/petal-and-bean-test';
if (!/test/i.test(new URL(TEST_URI).pathname)) throw new Error('Refusing to run: test database name must contain "test"');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const mongoose = (await import('mongoose')).default;
const { createApp } = await import('../src/app.js');
const { seedAdmin, seedProducts } = await import('../src/seed/seedData.js');
const { Product } = await import('../src/models/Product.js');
const { User } = await import('../src/models/User.js');

const app = createApp({ limitLogins: false });
const api = () => request(app);
let token;
const auth = (r) => r.set('Authorization', `Bearer ${token}`);
const login = async () => (await api().post('/api/auth/login').send({ email: 'fizza-waseem@email.com', pin: '2580' })).body.token;
const bySlug = async (name) => Product.findOne({ nameKey: name.toLowerCase() });
const customer = { name: 'Ayesha Khan', phone: '0300 1234567' };

let onFerretDB = false;
before(async () => {
  await connectDB(TEST_URI);
  const info = await mongoose.connection.db.admin().command({ buildInfo: 1 });
  onFerretDB = Boolean(info.ferretdbVersion);
});
after(async () => { await mongoose.connection.dropDatabase(); await disconnectDB(); });
beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  await seedAdmin();
  await seedProducts();
  token = await login();
});

describe('auth', () => {
  it('logs in with the right email (case-insensitive) and PIN', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'FIZZA-WASEEM@EMAIL.COM', pin: '2580' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.pinHash, undefined, 'PIN hash must never be sent to the client');
    assert.equal(res.body.user.email, 'Fizza-waseem@email.com', 'email is shown exactly as saved, like the original app');
  });
  it('rejects a wrong PIN and an unknown email with the same message', async () => {
    const a = await api().post('/api/auth/login').send({ email: 'fizza-waseem@email.com', pin: '1111' });
    const b = await api().post('/api/auth/login').send({ email: 'nobody@email.com', pin: '2580' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });
  it('locks the account after 5 wrong PINs, even for the right PIN', async () => {
    for (let i = 0; i < 5; i++) await api().post('/api/auth/login').send({ email: 'fizza-waseem@email.com', pin: '0000' });
    const res = await api().post('/api/auth/login').send({ email: 'fizza-waseem@email.com', pin: '2580' });
    assert.equal(res.status, 429);
  });
  it('protects every other route', async () => {
    for (const path of ['/api/products', '/api/orders', '/api/customers', '/api/inventory', '/api/sales/summary', '/api/settings']) {
      assert.equal((await api().get(path)).status, 401, path);
    }
  });
  it('rejects a tampered token', async () => {
    const res = await api().get('/api/products').set('Authorization', `Bearer ${token}x`);
    assert.equal(res.status, 401);
  });
});

describe('products & settings', () => {
  it('serves the 18 original products', async () => {
    const res = await auth(api().get('/api/products'));
    assert.equal(res.body.data.length, 18);
    const cap = res.body.data.find((p) => p.name === 'Cappuccino');
    assert.equal(cap.price, 450);
    assert.equal(cap.category, 'coffee');
    assert.equal(cap.icon, '☕');
  });
  it('serves shop settings (5% tax, Rs.)', async () => {
    const res = await auth(api().get('/api/settings'));
    assert.equal(res.body.taxRate, 0.05);
    assert.equal(res.body.currency, 'Rs.');
    assert.equal(res.body.categories.length, 6);
  });
  it('creates, edits and archives a product; duplicate names are refused', async () => {
    const created = await auth(api().post('/api/products')).send({ name: 'Mocha', price: 500, category: 'coffee', stock: 8 });
    assert.equal(created.status, 201);
    const dup = await auth(api().post('/api/products')).send({ name: 'MOCHA', price: 1, category: 'coffee' });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.message, 'A product with that name already exists.');
    const id = created.body.data.id;
    const edited = await auth(api().patch(`/api/products/${id}`)).send({ price: 525 });
    assert.equal(edited.body.data.price, 525);
    await auth(api().delete(`/api/products/${id}`));
    const menu = await auth(api().get('/api/products'));
    assert.ok(!menu.body.data.some((p) => p.id === id), 'archived product leaves the menu');
  });
  it('validates product input', async () => {
    const res = await auth(api().post('/api/products')).send({ name: '', price: -5, category: 'nope' });
    assert.equal(res.status, 400);
  });
});

describe('orders', () => {
  const place = (items, payment = { method: 'Cash' }, cust = customer) =>
    auth(api().post('/api/orders')).send({ customer: cust, items, payment });

  it('computes subtotal, 5% tax and total on the server and returns a bill number', async () => {
    const cap = await bySlug('Cappuccino');
    const res = await place([{ productId: String(cap._id), qty: 2 }]); // 2 × 450 = 900, tax 45
    assert.equal(res.status, 201);
    const o = res.body.data;
    assert.equal(o.billNo, 'PB-0001');
    assert.equal(o.subtotal, 900);
    assert.equal(o.tax, 45);
    assert.equal(o.total, 945);
    assert.equal(o.customer, 'Ayesha Khan');
    assert.equal(o.method, 'Cash');
    assert.equal(o.cashReceived, 945, 'blank cash = exact amount, like the original');
    assert.equal(o.change, 0);
    assert.deepEqual(o.items[0], { product: String(cap._id), name: 'Cappuccino', price: 450, qty: 2, amount: 900 });
  });
  it('ignores any price/total the browser sends', async () => {
    const cap = await bySlug('Cappuccino');
    const res = await auth(api().post('/api/orders')).send({
      customer, payment: { method: 'Cash' }, total: 1,
      items: [{ productId: String(cap._id), qty: 1, price: 1 }],
    });
    assert.equal(res.body.data.total, 472.5);
  });
  it('rounds tax to 2 decimals and calculates change', async () => {
    const bagel = await bySlug('Cinnamon bagel'); // 260 → tax 13
    const water = await bySlug('Mineral water');  // 120
    const res = await place([{ productId: String(bagel._id), qty: 1 }, { productId: String(water._id), qty: 3 }], { method: 'Cash', cashReceived: 1000 });
    const o = res.body.data; // subtotal 620, tax 31, total 651
    assert.equal(o.total, 651);
    assert.equal(o.change, 349);
  });
  it('rejects cash below the total', async () => {
    const cap = await bySlug('Cappuccino');
    const res = await place([{ productId: String(cap._id), qty: 1 }], { method: 'Cash', cashReceived: 100 });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /at least/);
    assert.equal((await Product.findById(cap._id)).stock, 60, 'a failed payment must not touch stock');
  });
  it('accepts card with or without last 4 digits, rejects malformed digits', async () => {
    const cap = await bySlug('Cappuccino');
    const items = [{ productId: String(cap._id), qty: 1 }];
    assert.equal((await place(items, { method: 'Card', cardLast4: '4242' })).body.data.cardLast4, '4242');
    assert.equal((await place(items, { method: 'Card', cardLast4: '' })).body.data.cardLast4, null);
    assert.equal((await place(items, { method: 'Card', cardLast4: '42' })).status, 400);
  });
  it('validates customer name and phone like the original form', async () => {
    const cap = await bySlug('Cappuccino');
    const items = [{ productId: String(cap._id), qty: 1 }];
    assert.equal((await place(items, { method: 'Cash' }, { name: '', phone: '0300 1234567' })).status, 400);
    assert.equal((await place(items, { method: 'Cash' }, { name: 'A', phone: '123' })).status, 400);
    assert.equal((await place([], { method: 'Cash' })).status, 400);
  });
  it('numbers bills sequentially', async () => {
    const cap = await bySlug('Cappuccino');
    const items = [{ productId: String(cap._id), qty: 1 }];
    const nos = [];
    for (let i = 0; i < 3; i++) nos.push((await place(items)).body.data.billNo);
    assert.deepEqual(nos, ['PB-0001', 'PB-0002', 'PB-0003']);
  });
  it('creates a customer once per phone number and keeps their running totals', async () => {
    const cap = await bySlug('Cappuccino');
    const items = [{ productId: String(cap._id), qty: 1 }]; // 472.5 each
    await place(items, { method: 'Cash' }, { name: 'Ayesha Khan', phone: '0300 1234567' });
    await place(items, { method: 'Card' }, { name: 'Ayesha K.', phone: '0300-1234567' }); // same digits
    await place(items, { method: 'Cash' }, { name: 'Bilal', phone: '0311 7654321' });
    const res = await auth(api().get('/api/customers'));
    assert.equal(res.body.total, 2);
    const ayesha = res.body.data.find((c) => c.phone === '0300 1234567');
    assert.equal(ayesha.orders, 2);
    assert.equal(ayesha.totalSpent, 945);
    assert.equal(ayesha.name, 'Ayesha K.', 'latest name wins, as before');
  });
  it('lists bills newest first with pagination, search and filters', async () => {
    const cap = await bySlug('Cappuccino');
    const items = [{ productId: String(cap._id), qty: 1 }];
    for (let i = 0; i < 5; i++) await place(items, { method: i % 2 ? 'Card' : 'Cash' }, { name: i === 4 ? 'Zara' : 'Ayesha', phone: '0300 1234567' });
    const page1 = await auth(api().get('/api/orders?limit=2&page=1'));
    assert.equal(page1.body.total, 5);
    assert.equal(page1.body.pages, 3);
    assert.equal(page1.body.data[0].billNo, 'PB-0005');
    assert.equal((await auth(api().get('/api/orders?limit=2&page=3'))).body.data.length, 1);
    assert.equal((await auth(api().get('/api/orders?search=zara'))).body.total, 1);
    assert.equal((await auth(api().get('/api/orders?method=Card'))).body.total, 2);
    assert.equal((await auth(api().get('/api/orders?all=true'))).body.data.length, 5);
  });
  it('summarises sales for the history tiles', async () => {
    const cap = await bySlug('Cappuccino');
    const items = [{ productId: String(cap._id), qty: 2 }]; // 945
    await place(items, { method: 'Cash' });
    await place(items, { method: 'Card' });
    await place([{ productId: String(cap._id), qty: 1 }], { method: 'Cash' }); // 472.5
    const s = (await auth(api().get('/api/sales/summary'))).body;
    assert.deepEqual({ bills: s.bills, revenue: s.revenue, cash: s.cash, card: s.card }, { bills: 3, revenue: 2362.5, cash: 1417.5, card: 945 });
  });
  it('keeps old receipts correct after a price change', async () => {
    const cap = await bySlug('Cappuccino');
    const o = (await place([{ productId: String(cap._id), qty: 1 }])).body.data;
    await auth(api().patch(`/api/products/${cap._id}`)).send({ price: 999, name: 'Cappuccino XL' });
    const again = (await auth(api().get(`/api/orders/${o.id}`))).body.data;
    assert.equal(again.items[0].name, 'Cappuccino');
    assert.equal(again.items[0].price, 450);
    assert.equal(again.total, 472.5);
  });
});

describe('inventory', () => {
  const place = (items) => auth(api().post('/api/orders')).send({ customer, items, payment: { method: 'Cash' } });

  it('reduces stock when a bill is paid and logs the movement', async () => {
    const croissant = await bySlug('Butter croissant');
    await place([{ productId: String(croissant._id), qty: 4 }]);
    assert.equal((await Product.findById(croissant._id)).stock, 26);
    const mv = (await auth(api().get(`/api/inventory/movements?productId=${croissant._id}`))).body.data;
    assert.equal(mv[0].reason, 'sale');
    assert.equal(mv[0].delta, -4);
    assert.equal(mv[0].balance, 26);
    assert.equal(mv[0].billNo, 'PB-0001');
  });
  it('refuses to oversell and leaves ALL stock untouched (all-or-nothing)', async () => {
    const cake = await bySlug('Macaron box'); // stock 10
    const water = await bySlug('Mineral water'); // stock 100
    const res = await place([{ productId: String(water._id), qty: 5 }, { productId: String(cake._id), qty: 11 }]);
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Only 10 of "Macaron box" left/);
    assert.equal((await Product.findById(water._id)).stock, 100, 'earlier line was rolled back');
    assert.equal((await Product.findById(cake._id)).stock, 10);
    assert.equal((await auth(api().get('/api/orders'))).body.total, 0, 'no bill was created');
  });
  it('says "sold out" at zero', async () => {
    const cake = await bySlug('Macaron box');
    await Product.updateOne({ _id: cake._id }, { stock: 0 });
    const res = await place([{ productId: String(cake._id), qty: 1 }]);
    assert.equal(res.status, 409);
    assert.match(res.body.message, /sold out/);
  });
  it('two cashiers racing for the last item: exactly one wins, stock never goes negative', async (t) => {
    // FerretDB (a MongoDB look-alike) does not make concurrent single-document updates atomic; real MongoDB / Atlas does.
    if (onFerretDB) return t.skip('needs real MongoDB: FerretDB loses concurrent writes');
    const cake = await bySlug('Macaron box');
    await Product.updateOne({ _id: cake._id }, { stock: 1 });
    const results = await Promise.all(Array.from({ length: 6 }, () => place([{ productId: String(cake._id), qty: 1 }])));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 5);
    assert.equal((await Product.findById(cake._id)).stock, 0);
  });
  it('does not track stock for products with trackStock off', async () => {
    const water = await bySlug('Mineral water');
    await Product.updateOne({ _id: water._id }, { trackStock: false, stock: 0 });
    assert.equal((await place([{ productId: String(water._id), qty: 50 }])).status, 201);
  });
  it('restocks, removes and sets an exact count; refuses to go below zero', async () => {
    const cake = await bySlug('Macaron box'); // 10
    const id = String(cake._id);
    assert.equal((await auth(api().post(`/api/inventory/${id}/adjust`)).send({ delta: 5 })).body.data.stock, 15);
    assert.equal((await auth(api().post(`/api/inventory/${id}/adjust`)).send({ delta: -3, note: 'dropped' })).body.data.stock, 12);
    assert.equal((await auth(api().post(`/api/inventory/${id}/adjust`)).send({ set: 7 })).body.data.stock, 7);
    assert.equal((await auth(api().post(`/api/inventory/${id}/adjust`)).send({ delta: -8 })).status, 409);
    assert.equal((await Product.findById(id)).stock, 7);
    assert.equal((await auth(api().post(`/api/inventory/${id}/adjust`)).send({})).status, 400);
  });
  it('reports low / out of stock in the inventory summary', async () => {
    const a = await bySlug('Macaron box');
    const b = await bySlug('Waffle stack');
    await Product.updateOne({ _id: a._id }, { stock: 0 });
    await Product.updateOne({ _id: b._id }, { stock: 3 }); // lowStockAt = 5
    const inv = (await auth(api().get('/api/inventory'))).body;
    assert.equal(inv.summary.out, 1);
    assert.equal(inv.summary.low, 1);
    assert.equal(inv.data.find((p) => p.name === 'Waffle stack').stockStatus, 'low');
  });
  it('only admins can change products or stock', async () => {
    await User.create({ email: 'cashier@email.com', role: 'cashier', pinHash: await User.hashPin('1234') });
    const t = (await api().post('/api/auth/login').send({ email: 'cashier@email.com', pin: '1234' })).body.token;
    const cake = await bySlug('Macaron box');
    const res = await api().post(`/api/inventory/${cake._id}/adjust`).set('Authorization', `Bearer ${t}`).send({ delta: 1 });
    assert.equal(res.status, 403);
    const sell = await api().post('/api/orders').set('Authorization', `Bearer ${t}`)
      .send({ customer, items: [{ productId: String(cake._id), qty: 1 }], payment: { method: 'Cash' } });
    assert.equal(sell.status, 201, 'cashiers can still sell');
  });
});

describe('roles & permissions', () => {
  let cashierToken;
  const asCashier = (r) => r.set('Authorization', `Bearer ${cashierToken}`);
  const cust = { name: 'Ayesha Khan', phone: '0300 1234567' };
  const sell = async (authFn, name = 'Cappuccino') => {
    const p = await bySlug(name);
    return authFn(api().post('/api/orders')).send({ customer: cust, items: [{ productId: String(p._id), qty: 1 }], payment: { method: 'Cash' } });
  };

  beforeEach(async () => {
    await User.create({ email: 'cashier@email.com', role: 'cashier', pinHash: await User.hashPin('1234') });
    cashierToken = (await api().post('/api/auth/login').send({ email: 'cashier@email.com', pin: '1234' })).body.token;
  });

  it('login and /auth/me return the role\'s permission list', async () => {
    const a = await api().post('/api/auth/login').send({ email: 'fizza-waseem@email.com', pin: '2580' });
    assert.ok(a.body.user.permissions.includes('staff:manage'));
    const c = await asCashier(api().get('/api/auth/me'));
    assert.ok(c.body.user.permissions.includes('sell'));
    assert.ok(!c.body.user.permissions.includes('inventory:adjust'));
    assert.equal(c.body.user.pinHash, undefined);
  });

  it('cashier can use the menu and sell', async () => {
    assert.equal((await asCashier(api().get('/api/products'))).status, 200);
    assert.equal((await asCashier(api().get('/api/settings'))).status, 200);
    assert.equal((await sell(asCashier)).status, 201);
  });

  it('cashier is blocked from inventory, stock history and product changes (403)', async () => {
    const cap = await bySlug('Cappuccino');
    const id = String(cap._id);
    assert.equal((await asCashier(api().get('/api/inventory'))).status, 403);
    assert.equal((await asCashier(api().get('/api/inventory/movements'))).status, 403);
    assert.equal((await asCashier(api().post('/api/inventory/' + id + '/adjust')).send({ delta: 1 })).status, 403);
    assert.equal((await asCashier(api().post('/api/products')).send({ name: 'X', price: 1, category: 'tea' })).status, 403);
    assert.equal((await asCashier(api().patch('/api/products/' + id)).send({ price: 1 })).status, 403);
    assert.equal((await asCashier(api().delete('/api/products/' + id))).status, 403);
    assert.equal((await Product.findById(id)).price, 450, 'nothing changed');
  });

  it('cashier only sees their own bills, their own totals, and cannot export', async () => {
    const adminBill = (await sell(auth)).body.data;
    const myBill = (await sell(asCashier)).body.data;
    const mine = await asCashier(api().get('/api/orders'));
    assert.equal(mine.body.total, 1);
    assert.equal(mine.body.data[0].id, myBill.id);
    assert.equal((await asCashier(api().get('/api/orders/' + myBill.id))).status, 200);
    assert.equal((await asCashier(api().get('/api/orders/' + adminBill.id))).status, 404, "someone else's bill looks like it doesn't exist");
    assert.equal((await asCashier(api().get('/api/orders?all=true'))).status, 403);
    assert.equal((await asCashier(api().get('/api/sales/summary'))).body.bills, 1);
    assert.equal((await auth(api().get('/api/orders'))).body.total, 2, 'admin still sees everything');
    assert.equal((await auth(api().get('/api/sales/summary'))).body.bills, 2);
  });

  it('cashier can search customers (max 10) but not list them all; admin can list all', async () => {
    await sell(auth);
    assert.equal((await asCashier(api().get('/api/customers'))).status, 400);
    assert.equal((await asCashier(api().get('/api/customers?search=a'))).status, 400);
    const found = await asCashier(api().get('/api/customers?search=ayesha'));
    assert.equal(found.status, 200);
    assert.equal(found.body.data.length, 1);
    assert.equal((await auth(api().get('/api/customers'))).status, 200);
  });

  it('a disabled account cannot log in and its existing token stops working', async () => {
    await User.updateOne({ emailKey: 'cashier@email.com' }, { active: false });
    assert.equal((await asCashier(api().get('/api/products'))).status, 401);
    const res = await api().post('/api/auth/login').send({ email: 'cashier@email.com', pin: '1234' });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /disabled/);
  });

  it('accounts created before the "active" field existed still work', async () => {
    await User.collection.updateOne({ emailKey: 'cashier@email.com' }, { $unset: { active: '' } });
    assert.equal((await asCashier(api().get('/api/products'))).status, 200);
    assert.equal((await api().post('/api/auth/login').send({ email: 'cashier@email.com', pin: '1234' })).status, 200);
  });

  it('a role change applies immediately, even to a token issued earlier', async () => {
    const cap = await bySlug('Cappuccino');
    assert.equal((await auth(api().post(`/api/inventory/${cap._id}/adjust`)).send({ delta: 1 })).status, 200);
    await User.updateOne({ emailKey: 'fizza-waseem@email.com' }, { role: 'cashier' });
    assert.equal((await auth(api().post(`/api/inventory/${cap._id}/adjust`)).send({ delta: 1 })).status, 403);
  });
});

describe('staff management & PINs', () => {
  const adminEmail = 'fizza-waseem@email.com';
  const PW = 'Sara-cafe-482';     // initial password for the test cashier
  const PW2 = 'Latte-art-7391';   // a second valid password, used for resets and changes
  const loginAs = (email, pin) => api().post('/api/auth/login').send({ email, pin });
  const addStaff = (body) => auth(api().post('/api/staff')).send({ name: 'Sara Ahmed', email: 'sara@email.com', role: 'cashier', pin: PW, ...body });
  const adminId = async () => String((await User.findOne({ emailKey: adminEmail }))._id);

  it('admin creates a cashier who can then log in; the response never leaks the PIN hash', async () => {
    const res = await addStaff();
    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, 'cashier');
    assert.equal(res.body.data.pinHash, undefined);
    assert.equal(res.body.data.tokenVersion, undefined);
    const l = await loginAs('Sara@Email.com', PW);
    assert.equal(l.status, 200);
    assert.equal(l.body.user.role, 'cashier');
    const stored = await User.findOne({ emailKey: 'sara@email.com' });
    assert.notEqual(stored.pinHash, PW);
    assert.match(stored.pinHash, /^\$2[aby]\$/, 'stored as a bcrypt hash');
  });

  it('refuses a duplicate email (any capitalisation) and a bad email', async () => {
    await addStaff();
    assert.equal((await addStaff({ email: 'SARA@email.com' })).status, 409);
    assert.equal((await addStaff({ email: 'not-an-email' })).status, 400);
    assert.equal((await addStaff({ email: 'x@email.com', name: '  ' })).status, 400);
  });

   it('only accepts 8-72 character passwords that are not trivially guessable', async () => {
    const bad = ['1234', '123456', '2580', '1234567', '11111111', '12345678', 'password', 'abcdefgh', 'zyxwvuts', 'ab1'.repeat(25)];
    for (const [i, pin] of bad.entries()) {
      assert.equal((await addStaff({ email: `t${i}@email.com`, pin })).status, 400, `rejects ${pin}`);
    }
    assert.equal((await addStaff({ email: 'long@email.com', pin: 'correct horse battery' })).status, 201, 'spaces are allowed');
    assert.equal((await loginAs('long@email.com', 'correct horse battery')).status, 200, 'a long password can log in');
  });

  it('cashiers cannot touch any staff endpoint (403)', async () => {
    await addStaff();
    const ct = (await loginAs('sara@email.com', PW)).body.token;
    const asC = (r) => r.set('Authorization', `Bearer ${ct}`);
    const id = await adminId();
    assert.equal((await asC(api().get('/api/staff'))).status, 403);
    assert.equal((await asC(api().post('/api/staff')).send({ name: 'X', email: 'x@email.com', pin: PW })).status, 403);
    assert.equal((await asC(api().patch('/api/staff/' + id)).send({ active: false })).status, 403);
    assert.equal((await asC(api().post(`/api/staff/${id}/pin`)).send({ pin: PW })).status, 403);
  });

  it('lists everyone, admins first, including accounts that predate the "active" field', async () => {
    await addStaff();
    await User.collection.updateOne({ emailKey: 'sara@email.com' }, { $unset: { active: '' } });
    const res = await auth(api().get('/api/staff'));
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.data[0].role, 'admin');
    assert.equal(res.body.data[1].active, true);
    assert.ok(res.body.data.every((u) => u.pinHash === undefined && u.emailKey === undefined));
  });

  it('renames, changes role, disables and re-enables; email cannot be changed', async () => {
    const id = (await addStaff()).body.data.id;
    assert.equal((await auth(api().patch('/api/staff/' + id)).send({ name: 'Sara A.' })).body.data.name, 'Sara A.');
    assert.equal((await auth(api().patch('/api/staff/' + id)).send({ email: 'new@email.com' })).status, 400, 'nothing editable sent');
    assert.equal((await User.findById(id)).email, 'sara@email.com');
    await auth(api().patch('/api/staff/' + id)).send({ active: false });
    assert.equal((await loginAs('sara@email.com', PW)).status, 403);
    await auth(api().patch('/api/staff/' + id)).send({ active: true });
    assert.equal((await loginAs('sara@email.com', PW)).status, 200);
    assert.equal((await auth(api().patch('/api/staff/' + id)).send({ role: 'admin' })).body.data.role, 'admin');
    assert.equal((await auth(api().patch('/api/staff/000000000000000000000000')).send({ name: 'Z' })).status, 404);
    assert.equal((await auth(api().patch('/api/staff/not-an-id')).send({ name: 'Z' })).status, 400);
  });

  it('an admin cannot demote or disable themselves (so the last admin can never be removed)', async () => {
    const id = await adminId();
    assert.equal((await auth(api().patch('/api/staff/' + id)).send({ role: 'cashier' })).status, 403);
    assert.equal((await auth(api().patch('/api/staff/' + id)).send({ active: false })).status, 403);
    assert.equal((await auth(api().patch('/api/staff/' + id)).send({ name: 'Boss' })).status, 200, 'renaming yourself is fine');
    assert.equal((await User.findById(id)).role, 'admin');
  });

  it('admin resets someone else\'s PIN: old PIN and old sessions stop working, a lockout is cleared', async () => {
    const id = (await addStaff()).body.data.id;
    const oldToken = (await loginAs('sara@email.com', PW)).body.token;
    for (let i = 0; i < 5; i++) await loginAs('sara@email.com', '9999');
    assert.equal((await loginAs('sara@email.com', PW)).status, 429, 'locked');
    assert.equal((await auth(api().post(`/api/staff/${id}/pin`)).send({ pin: '1111' })).status, 400, 'trivial PIN refused');
    assert.equal((await auth(api().post(`/api/staff/${id}/pin`)).send({ pin: PW2 })).status, 200);
    assert.equal((await loginAs('sara@email.com', PW)).status, 401);
    assert.equal((await loginAs('sara@email.com', PW2)).status, 200, 'unlocked, new PIN works');
    assert.equal((await api().get('/api/products').set('Authorization', `Bearer ${oldToken}`)).status, 401, 'old session ended');
  });

  it('an admin cannot use the reset route on themselves', async () => {
    assert.equal((await auth(api().post(`/api/staff/${await adminId()}/pin`)).send({ pin: PW2 })).status, 400);
  });

  it('change-PIN: needs the right current PIN, keeps this session, ends the others', async () => {
    const other = await login(); // a second session for the same admin
    const wrong = await auth(api().post('/api/auth/change-pin')).send({ currentPin: '9999', newPin: PW2 });
    assert.equal(wrong.status, 400, '400 (not 401) so the app does not log the person out');
    assert.equal((await auth(api().post('/api/auth/change-pin')).send({ currentPin: '2580', newPin: '2580' })).status, 400, 'trivial/default PIN');
    assert.equal((await auth(api().post('/api/auth/change-pin')).send({ currentPin: '2580', newPin: 'password' })).status, 400, 'easy PIN');
        const ok = await auth(api().post('/api/auth/change-pin')).send({ currentPin: '2580', newPin: PW2 });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token && ok.body.user.permissions.length > 0);
    assert.equal((await api().get('/api/products').set('Authorization', `Bearer ${ok.body.token}`)).status, 200, 'this session continues with the new token');
    assert.equal((await auth(api().get('/api/products'))).status, 401, 'the old token for this session is dead');
    assert.equal((await api().get('/api/products').set('Authorization', `Bearer ${other}`)).status, 401, 'other sessions are dead');
    assert.equal((await loginAs(adminEmail, '2580')).status, 401);
    assert.equal((await loginAs(adminEmail, PW2)).status, 200);
  });

  it('change-PIN counts wrong current PINs and locks after 5', async () => {
    for (let i = 0; i < 5; i++) await auth(api().post('/api/auth/change-pin')).send({ currentPin: '9999', newPin: PW2 });
    assert.equal((await auth(api().post('/api/auth/change-pin')).send({ currentPin: '2580', newPin: PW2 })).status, 429);
  });
});

describe('demo login picker', () => {
  it('lists active accounts with no secrets, and login still needs the real password', async () => {
    const res = await api().get('/api/auth/demo-accounts');
    assert.equal(res.status, 200);
    assert.ok(res.body.accounts.some((a) => a.email === 'Fizza-waseem@email.com' && a.role === 'admin'));
    for (const a of res.body.accounts) assert.deepEqual(Object.keys(a).sort(), ['email', 'name', 'role']);
    const bad = await api().post('/api/auth/login').send({ email: 'fizza-waseem@email.com', pin: 'not-the-password' });
    assert.equal(bad.status, 401);
  });
});

describe('staff performance report', () => {
  let cashierToken;
  const cashierAuth = (r) => r.set('Authorization', `Bearer ${cashierToken}`);
  const sell = (as, qty = 1, cust = customer) =>
    bySlug('Cappuccino').then((cap) => as(api().post('/api/orders')).send({ customer: cust, items: [{ productId: String(cap._id), qty }], payment: { method: 'Cash' } }));

  beforeEach(async () => {
    await auth(api().post('/api/staff')).send({ name: 'Sana', email: 'sana@email.com', role: 'cashier', pin: 'Cafe-Beans-42' });
    cashierToken = (await api().post('/api/auth/login').send({ email: 'sana@email.com', pin: 'Cafe-Beans-42' })).body.token;
  });

  it('is admin-only on the server', async () => {
    assert.equal((await cashierAuth(api().get('/api/reports/staff'))).status, 403);
    assert.equal((await api().get('/api/reports/staff')).status, 401);
    const list = await auth(api().get('/api/staff'));
    const sana = list.body.data.find((s) => s.email === 'sana@email.com');
    assert.equal((await cashierAuth(api().get(`/api/reports/staff/${sana.id}/orders`))).status, 403);
  });

  it('attributes each sale to the logged-in staff member and counts distinct customers', async () => {
    await sell(cashierAuth);                                              // Sana: 472.5
    await sell(cashierAuth, 2);                                           // Sana: 945, same customer
    await sell(auth, 1, { name: 'Bilal', phone: '0301 7654321' });        // admin: 472.5
    const res = await auth(api().get('/api/reports/staff'));
    assert.equal(res.status, 200);
    const sana = res.body.data.find((s) => s.email === 'sana@email.com');
    const admin = res.body.data.find((s) => s.role === 'admin');
    assert.equal(sana.bills, 2); assert.equal(sana.sales, 1417.5); assert.equal(sana.customers, 1);
    assert.equal(admin.bills, 1); assert.equal(admin.sales, 472.5);
    assert.equal(res.body.totals.bills, 3); assert.equal(res.body.totals.customers, 2);
    const hist = await auth(api().get(`/api/reports/staff/${sana.id}/orders`));
    assert.equal(hist.body.total, 2);
  });

  it('applies the date filter and rejects a reversed range', async () => {
    await sell(cashierAuth);
    const future = await auth(api().get('/api/reports/staff').query({ from: '2999-01-01T00:00:00.000Z' }));
    assert.equal(future.body.totals.bills, 0);
    const bad = await auth(api().get('/api/reports/staff').query({ from: '2026-02-01', to: '2026-01-01' }));
    assert.equal(bad.status, 400);
  });
});