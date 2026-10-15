import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';

// What kinds of alerts exist. Keep this list in one place so routes and screens can reuse it.
export const NOTIFICATION_TYPES = ['low_stock', 'out_of_stock', 'sale', 'staff'];

// Alerts are kept for 60 days, then MongoDB removes them by itself (change this number if you want longer or shorter).
const KEEP_DAYS = 60;

// One row = one alert, shared by everyone who is allowed to see it.
// "Who may see it" is decided by `audience` + `owner`; "who has read / cleared it" is stored per person.
const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, default: '', trim: true, maxlength: 300 },

    // 'admin' = admins only (staff-account alerts). 'all' = admins and cashiers (sales, stock).
    audience: { type: String, enum: ['admin', 'all'], required: true },
    // Email (lower-case) of the cashier a sale alert belongs to. null = not tied to one person.
    // Admins see every alert; a cashier sees only 'all' alerts that are untied or tied to them.
    owner: { type: String, default: null },

    ref: { type: String, default: '' }, // product id, bill number or staff id this alert is about

    // Stops duplicates: only ONE alert may exist with a given key (e.g. "stock:<productId>:low").
    // Alerts that may repeat (staff events) leave this empty. A low-stock key is removed once the product is restocked.
    dedupeKey: { type: String, default: undefined },

    // Per-person state, stored as user ids, so one admin reading an alert does not hide it from another.
    readBy: { type: [String], default: [] },
    dismissedBy: { type: [String], default: [] },
  },
  { timestamps: true, toJSON: cleanJson(['audience', 'owner', 'dedupeKey', 'readBy', 'dismissedBy']) }
);

notificationSchema.index({ audience: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: KEEP_DAYS * 24 * 60 * 60 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

export const Notification = mongoose.model('Notification', notificationSchema);