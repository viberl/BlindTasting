import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from "drizzle-orm";

// Direct database connection configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'blindtasting',
  user: 'postgres', // Adjust if your PostgreSQL user is different
  password: 'postgres', // Adjust with your PostgreSQL password
});

const db = drizzle(pool);

async function addScoreToParticipants() {
  let client;
  try {
    console.log("Connecting to database...");
    client = await pool.connect();
    
    console.log("Checking if score column exists in participants table...");
    
    // Check if the score column exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'participants' AND column_name = 'score';
    `;
    
    const result = await client.query(checkQuery);
    
    if (result.rows.length === 0) {
      console.log("Adding score column to participants table...");
      // Add the score column
      await client.query(`
        ALTER TABLE participants 
        ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
      `);
      console.log("Successfully added score column to participants table");
    } else {
      console.log("Score column already exists in participants table");
    }
  } catch (error) {
    console.error("Error adding score column to participants table:", error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    process.exit(0);
  }
}

addScoreToParticipants();
