import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the project root
const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath });

import { db } from '../db';
import { sql } from 'drizzle-orm';

async function createVinaturelTable() {
  try {
    console.log('Creating vinaturel_wines table...');
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vinaturel_wines (
        id SERIAL PRIMARY KEY,
        external_id TEXT NOT NULL UNIQUE,
        article_number TEXT,
        producer TEXT NOT NULL,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        region TEXT NOT NULL,
        vintage INTEGER NOT NULL,
        varietal_1 TEXT,
        varietal_2 TEXT,
        varietal_3 TEXT,
        product_url TEXT,
        image_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('✅ vinaturel_wines table created successfully');
  } catch (error) {
    console.error('❌ Error creating vinaturel_wines table:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

createVinaturelTable();
