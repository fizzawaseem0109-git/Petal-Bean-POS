import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB(uri = env.mongoUri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  } catch (err) {
    console.error('\n✖ Could not connect to MongoDB at:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
    console.error('  • Is MongoDB running locally? (or check your Atlas connection string / IP allow-list)');
    console.error('  • Is MONGODB_URI correct in server/.env ?\n');
    throw err;
  }
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
