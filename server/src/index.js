import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { ensureSeed } from './seed/seedData.js';

try {
  await connectDB();
  console.log('✔ MongoDB connected');
  if (env.autoSeed) await ensureSeed();
} catch {
  process.exit(1);
}

const app = createApp({ logRequests: !env.isProd });
const server = app.listen(env.port, () => {
  console.log(`✔ Petal & Bean API running on http://localhost:${env.port}`);
});

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `✖ Port ${env.port} is already in use. Change PORT in server/.env` : err);
  process.exit(1);
});

const shutdown = async () => {
  server.close();
  await mongoose.disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
