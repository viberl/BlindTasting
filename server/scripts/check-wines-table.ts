import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Create a database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/blindtasting',
});

const db = drizzle(pool);

async function checkWinesTable() {
  try {
    // Get table columns
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'wines';
    `);

    console.log('Columns in wines table:');
    console.table(result.rows);

    // Check if image_url exists
    const hasImageUrl = result.rows.some((row: any) => row.column_name === 'image_url');
    console.log(`\nImage URL column exists: ${hasImageUrl ? '✅ Yes' : '❌ No'}`);

    if (!hasImageUrl) {
      console.log('\nAdding image_url column...');
      await db.execute(sql`
        ALTER TABLE wines ADD COLUMN image_url text;
      `);
      console.log('✅ Added image_url column to wines table');
    }
  } catch (error) {
    console.error('Error checking wines table:', error);
  } finally {
    await pool.end();
  }
}

checkWinesTable().catch(console.error);
