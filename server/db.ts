import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the project root
const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath });

// Use DATABASE_URL from environment or fallback to default
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/blindtasting';

console.log('Using database URL:', databaseUrl);

// Create a new pool instance
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create the drizzle instance
export const db = drizzle(pool, { schema });

export { pool };
