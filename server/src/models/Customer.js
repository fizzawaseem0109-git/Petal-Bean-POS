import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';
import { round2 } from '../utils/money.js';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    phoneKey: { type: String, required: true, unique: true }, // digits only
    orders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastVisit: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      ...cleanJson(['phoneKey']),
      transform(doc, ret) {
        cleanJson(['phoneKey']).transform(doc, ret);
        ret.totalSpent = round2(ret.totalSpent);
        return ret;
      },
    },
  }
);

export const Customer = mongoose.model('Customer', customerSchema);
