import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function checkParticipantsSchema() {
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
      WHERE table_name = 'participants';
    `);
    
    console.log('Current participants table structure:');
    console.table(tableInfo.rows);
    
    // Check if score column exists
    const scoreColumnExists = tableInfo.rows.some(col => col.column_name === 'score');
    console.log(`Score column exists: ${scoreColumnExists}`);
    
  } catch (error) {
    console.error('Error checking participants schema:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkParticipantsSchema();
