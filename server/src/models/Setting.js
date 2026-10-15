import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';

// ONE document (_id 'shop') holds the café settings that an admin can edit in the app.
// A field that was never saved is simply missing, and the server falls back to the value in .env
// (see services/settingsService.js), so nothing changes until an admin saves something.
const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'shop' },
    shopName: { type: String, trim: true, minlength: 1, maxlength: 60 },
    shopAddress: { type: String, trim: true, maxlength: 120 },
    shopPhone: { type: String, trim: true, maxlength: 30 },
    currency: { type: String, trim: true, minlength: 1, maxlength: 8 },
    taxRate: { type: Number, min: 0, max: 1 }, // 0.05 = 5 %
    updatedBy: { type: String, default: '' },   // email of the admin who saved last
  },
  { timestamps: true, toJSON: cleanJson() }
);

export const Setting = mongoose.model('Setting', settingSchema);