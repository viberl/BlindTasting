import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function checkTastingsSchema() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env file');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();
  
  try {
    // Check table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'tastings';
    `);
    
    console.log('Current tastings table structure:');
    console.table(tableInfo.rows);
    
  } catch (error) {
    console.error('Error checking tastings schema:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkTastingsSchema().catch(console.error);
