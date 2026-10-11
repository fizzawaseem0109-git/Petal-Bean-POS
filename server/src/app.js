import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { buildRouter } from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ limitLogins = true, logRequests = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render/Railway/Nginx, so rate limiting sees the real client IP

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'upgrade-insecure-requests': null, // would break http://localhost in Safari
          'img-src': ["'self'", 'data:', 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        },
      },
    })
  );
  app.use(cors({ origin: env.clientUrls, credentials: false }));
  app.use(express.json({ limit: '100kb' }));
  if (logRequests) app.use(morgan('dev'));

  app.use('/api', buildRouter({ limitLogins }));
  app.use('/api', notFound);

  // Production: one server serves both the API and the built React app.
  const dist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
  }

  app.use(errorHandler);
  return app;
}
