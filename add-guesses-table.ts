import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function addGuessesTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // Create guesses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS guesses (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        wine_id INTEGER NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
        name TEXT,
        country TEXT,
        region TEXT,
        producer TEXT,
        vintage TEXT,
        varietals TEXT[],
        score INTEGER NOT NULL,
        rating INTEGER,
        notes TEXT,
        submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(participant_id, wine_id)
      );
    `);
    
    console.log('Successfully created guesses table');
    
  } catch (error) {
    console.error('Error creating guesses table:', error);
  } finally {
    await client.end();
  }
}

addGuessesTable();
