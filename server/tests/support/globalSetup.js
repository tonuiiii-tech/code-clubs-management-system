import { MongoMemoryServer } from 'mongodb-memory-server';

/** Starts an in-memory MongoDB (downloaded once on first run) for the database tests. */
export default async function globalSetup() {
  // Set MONGO_TEST_URI to use a MongoDB you already run instead.
  if (process.env.MONGO_TEST_URI) return;
  const server = await MongoMemoryServer.create();
  globalThis.__MONGO_SERVER__ = server;
  process.env.MONGO_TEST_URI = server.getUri();
}
