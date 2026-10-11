import { env } from '../config/env.js';
import { CATEGORIES } from '../constants/categories.js';

export const getSettings = (_req, res) => res.json({ ...env.shop, categories: CATEGORIES });
