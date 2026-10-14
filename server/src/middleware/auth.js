import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { can } from '../constants/permissions.js';

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role, ver: user.tokenVersion || 0 }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Please log in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Your session is no longer valid. Please log in again.');
    if (user.active === false) throw ApiError.unauthorized('Your account has been disabled. Please ask an admin.');
    if ((payload.ver ?? 0) !== (user.tokenVersion ?? 0)) throw ApiError.unauthorized('Your PIN was changed. Please log in again.');
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role)) throw ApiError.forbidden('Only an admin can do that.');
  next();
};

// Allow the request if the user's role has ANY of the listed permissions (see constants/permissions.js).
export const requirePermission = (...permissions) => (req, _res, next) => {
  if (!permissions.some((p) => can(req.user?.role, p))) throw ApiError.forbidden('You do not have permission to do that.');
  next();
};
