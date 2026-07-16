/**
 * CLI entry point for seed-travel-visa.ts
 * Usage: npx tsx src/db/run-seed.ts
 */

import 'dotenv/config';
import pg from 'pg';
import { seedTravelVisaData } from './seed-travel-visa.js';
import { seedInventoryData } from './seed-inventory.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

seedTravelVisaData(pool)
  .then(() => seedInventoryData(pool))
  .then(() => {
    console.log('Seed complete');
    return pool.end();
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    pool.end();
    process.exit(1);
  });
