import { CATEGORIES } from '../constants/categories.js';
import { getShopSettings, updateShopSettings } from '../services/settingsService.js';

// Same shape as before ({ shopName, shopAddress, shopPhone, currency, taxRate, categories }),
// but the values now come from the database, falling back to .env for anything never saved.
export async function getSettings(_req, res) {
  res.json({ ...(await getShopSettings()), categories: CATEGORIES });
}

// Admin only (the route requires the settings:manage permission). Body was already validated by updateSettingsSchema.
export async function updateSettings(req, res) {
  const shop = await updateShopSettings(req.valid.body, req.user.email);
  res.json({ ...shop, categories: CATEGORIES });
}