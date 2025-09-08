import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function addParticipantsTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // Create participants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        tasting_id INTEGER NOT NULL REFERENCES tastings(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(tasting_id, user_id)
      );
    `);
    
    console.log('Successfully created participants table');
    
  } catch (error) {
    console.error('Error creating participants table:', error);
  } finally {
    await client.end();
  }
}

addParticipantsTable();
