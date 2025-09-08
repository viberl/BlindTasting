import { Client } from 'pg';
import 'dotenv/config';

async function addJoinedAtColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // Add joined_at column if it doesn't exist
    await client.query(`
      ALTER TABLE participants 
      ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);
    
    console.log('Successfully added joined_at column to participants table');
    
    // Update existing records to have a joined_at value
    await client.query(`
      UPDATE participants 
      SET joined_at = created_at 
      WHERE joined_at IS NULL;
    `);
    
    console.log('Successfully updated existing records with joined_at values');
    
  } catch (error) {
    console.error('Error adding joined_at column:', error);
  } finally {
    await client.end();
  }
}

addJoinedAtColumn();
