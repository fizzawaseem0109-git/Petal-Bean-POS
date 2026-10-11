import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { ApiError } from '../utils/ApiError.js';

const DUPLICATE = 'A product with that name already exists.';
const onDuplicate = (err) => { throw err?.code === 11000 ? ApiError.conflict(DUPLICATE) : err; };

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listProducts(req, res) {
  const { category, search, includeInactive } = req.valid.query;
  const filter = {};
  if (!includeInactive) filter.active = true;
  if (category) filter.category = category;
  if (search) filter.name = { $regex: escapeRx(search), $options: 'i' };
  // Keep the original menu order: by category group then creation order
  const products = await Product.find(filter).sort({ createdAt: 1, _id: 1 });
  res.json({ data: products });
}

export async function createProduct(req, res) {
  const body = req.valid.body;
  const product = await Product.create(body).catch(onDuplicate);
  if (product.trackStock && product.stock > 0) {
    await StockMovement.create({
      product: product._id, productName: product.name, delta: product.stock,
      balance: product.stock, reason: 'initial', by: req.user.email,
    });
  }
  res.status(201).json({ data: product });
}

export async function updateProduct(req, res) {
  const product = await Product.findById(req.valid.params.id);
  if (!product) throw ApiError.notFound('Product not found.');
  product.set(req.valid.body);
  await product.save().catch(onDuplicate); // save() (not findByIdAndUpdate) so the name-key hook and validators run
  res.json({ data: product });
}

// Products that were sold before are referenced by old bills, so "delete" just takes them off the menu.
export async function archiveProduct(req, res) {
  const product = await Product.findByIdAndUpdate(req.valid.params.id, { $set: { active: false } }, { returnDocument: 'after' });
  if (!product) throw ApiError.notFound('Product not found.');
  res.json({ data: product });
}
