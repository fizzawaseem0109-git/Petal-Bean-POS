import mongoose from 'mongoose';
import { CATEGORY_IDS } from '../constants/categories.js';
import { cleanJson } from './plugins.js';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // lower-cased copy of `name`, used for a case-insensitive unique index
    nameKey: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, enum: CATEGORY_IDS, index: true },
    icon: { type: String, trim: true, maxlength: 16, default: '🍽️' },
    stock: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'Stock must be a whole number' } },
    lowStockAt: { type: Number, default: 5, min: 0 },
    trackStock: { type: Boolean, default: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, toJSON: cleanJson(['nameKey']) }
);

productSchema.pre('validate', function setNameKey() {
  if (this.name) this.nameKey = this.name.trim().toLowerCase();
});

// 'out' | 'low' | 'ok'  (products that don't track stock are always 'ok')
productSchema.virtual('stockStatus').get(function stockStatus() {
  if (!this.trackStock) return 'ok';
  if (this.stock <= 0) return 'out';
  if (this.stock <= this.lowStockAt) return 'low';
  return 'ok';
});

export const Product = mongoose.model('Product', productSchema);
