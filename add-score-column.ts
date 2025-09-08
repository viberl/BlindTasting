import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function addScoreColumn() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env file');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();
  
  try {
    console.log('Adding score column to participants table...');
    
    // Add the score column with a default value of 0
    await client.query(`
      ALTER TABLE participants 
      ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
    `);
    
    console.log('Successfully added score column to participants table');
    
    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'participants' AND column_name = 'score';
    `);
    
    console.log('Verification result:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('Error adding score column to participants table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addScoreColumn().catch(console.error);
