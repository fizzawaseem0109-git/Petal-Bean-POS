import { env } from '../config/env.js';
import { Setting } from '../models/Setting.js';

const SHOP_ID = 'shop';
const FIELDS = ['shopName', 'shopAddress', 'shopPhone', 'currency', 'taxRate'];

/**
 * The café settings the app should use RIGHT NOW:
 * the values an admin saved in the database, and for anything never saved, the value from .env.
 * Everything that needs the tax rate, currency or shop name (bills, receipts, the settings screen) asks here.
 */
export async function getShopSettings() {
  const saved = await Setting.findById(SHOP_ID).lean();
  const shop = { ...env.shop };
  if (saved) {
    for (const key of FIELDS) {
      if (saved[key] !== undefined && saved[key] !== null) shop[key] = saved[key]; // '' is allowed (clears the address)
    }
  }
  return shop;
}

/** Save only the fields that were sent. Returns the merged settings, same shape as getShopSettings(). */
export async function updateShopSettings(changes, by) {
  const $set = { updatedBy: by };
  for (const key of FIELDS) {
    if (changes[key] !== undefined) $set[key] = changes[key];
  }
  const save = () =>
    Setting.findOneAndUpdate({ _id: SHOP_ID }, { $set }, { upsert: true, runValidators: true, returnDocument: 'after' });
  try {
    await save();
  } catch (err) {
    if (err?.code !== 11000) throw err; // two first-ever saves raced to create the document: just retry once
    await save();
  }
  return getShopSettings();
}