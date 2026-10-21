/**
 * Development seed data: fictional Kenyan schools, clubs and users across the four regions.
 *
 * Rules (R1-12): fictional names only, phone numbers in the fake +254700000xxx range,
 * real counties and sub-counties, and never run against production.
 *
 * The data set is filled in once the database is chosen (decision D1-8).
 */
import { env } from '../src/config/env.js';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed: NODE_ENV is production.');
  process.exit(1);
}

console.log('Seed script ready. Seed data is added once the database is chosen (decision D1-8).');
