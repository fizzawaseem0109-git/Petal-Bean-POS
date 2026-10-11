import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },   // snapshot: receipts stay correct even if the product is renamed
    price: { type: Number, required: true },  // snapshot of the price at time of sale
    qty: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    billNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now, index: true },
    customer: {
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    method: { type: String, enum: ['Cash', 'Card'], required: true, index: true },
    cashReceived: { type: Number, default: null },
    change: { type: Number, default: null },
    cardLast4: { type: String, default: null },
    cashier: { type: String, default: '' }, // email of the user who rang it up
  },
  { timestamps: true }
);

// Flatten customer for the client: { customer: 'Ayesha', phone: '0300…' }, same shape the old app used.
orderSchema.set('toJSON', {
  ...cleanJson(),
  transform(doc, ret) {
    cleanJson().transform(doc, ret);
    const c = ret.customer || {};
    ret.customerId = c.customerId ? String(c.customerId) : null;
    ret.phone = c.phone;
    ret.customer = c.name;
    delete ret.createdAt;
    delete ret.updatedAt;
    return ret;
  },
});

export const Order = mongoose.model('Order', orderSchema);
