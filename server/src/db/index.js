import mongoose from 'mongoose';
import './models.js';

/**
 * MongoDB connection (D1-8). Only repositories (modules/<name>/<name>.repository.js)
 * and the files in this folder use Mongoose.
 */
export async function connectDatabase(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await syncIndexes();
}

/** Builds the indexes declared in models.js (unique email, club code, duplicate school check…). */
export async function syncIndexes() {
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
