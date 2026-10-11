import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';

// Audit trail: every change to a product's stock gets one row.
const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String, required: true },
    delta: { type: Number, required: true },   // +10 restock, -2 sale
    balance: { type: Number, required: true }, // stock after the change
    reason: { type: String, enum: ['sale', 'restock', 'adjustment', 'initial'], required: true },
    note: { type: String, default: '' },
    billNo: { type: String, default: null },
    by: { type: String, default: '' },
  },
  { timestamps: true, toJSON: cleanJson() }
);

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
