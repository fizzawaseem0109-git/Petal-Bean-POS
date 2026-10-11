import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const errors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return res.status(400).json({ message: errors[0]?.message || 'Invalid request.', errors });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body is not valid JSON.' });
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first?.message || 'Validation failed.' });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ message: `Invalid ${err.path}.` });
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'value';
    return res.status(409).json({ message: `That ${field === 'nameKey' ? 'name' : field} already exists.` });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ message: 'Something went wrong on the server.', ...(env.isProd ? {} : { detail: err?.message }) });
}
