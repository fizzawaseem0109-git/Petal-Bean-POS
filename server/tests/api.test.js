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
