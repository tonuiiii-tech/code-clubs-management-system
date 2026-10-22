import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../src/db/index.js';

/** Connects this test file to its own fresh database on the shared in-memory server. */
export function useTestDatabase() {
  beforeAll(async () => {
    const url = new URL(process.env.MONGO_TEST_URI);
    url.pathname = `/test-${randomUUID()}`;
    await connectDatabase(url.toString());
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });
}

/** Empties every collection (indexes are kept). */
export async function clearDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
