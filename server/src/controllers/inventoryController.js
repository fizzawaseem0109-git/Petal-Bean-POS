import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { adjustStock } from '../services/inventoryService.js';

export async function getInventory(_req, res) {
  const products = await Product.find({ active: true }).sort({ createdAt: 1, _id: 1 });
  const tracked = products.filter((p) => p.trackStock);
  res.json({
    data: products,
    summary: {
      products: products.length,
      units: tracked.reduce((s, p) => s + p.stock, 0),
      low: products.filter((p) => p.stockStatus === 'low').length,
      out: products.filter((p) => p.stockStatus === 'out').length,
    },
  });
}

export async function adjust(req, res) {
  const { product, movement } = await adjustStock(req.valid.params.id, req.valid.body, req.user.email);
  res.json({ data: product, movement });
}

export async function listMovements(req, res) {
  const { productId, limit } = req.valid.query;
  const movements = await StockMovement.find(productId ? { product: productId } : {}).sort({ createdAt: -1, _id: -1 }).limit(limit);
  res.json({ data: movements });
}
