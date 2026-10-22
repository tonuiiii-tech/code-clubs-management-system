import { env } from './config/env.js';
import { connectDatabase } from './db/index.js';
import { createApp } from './app.js';

await connectDatabase(env.MONGODB_URI);

createApp().listen(env.PORT, () => {
  console.log(`Code Clubs API listening on http://localhost:${env.PORT}/api/v1`);
});
