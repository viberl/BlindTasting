import { Client } from 'pg';
import 'dotenv/config';

async function checkGuessesTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // Get column information for guesses table
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'guesses';
    `);
    
    console.log('Guesses table columns:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('Error checking guesses table:', error);
  } finally {
    await client.end();
  }
}

checkGuessesTable();
