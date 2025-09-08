import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import 'dotenv/config';

async function checkTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // List all tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    
    console.log('Existing tables:');
    console.log(result.rows.map(row => row.table_name).join('\n'));
    
  } catch (error) {
    console.error('Error checking tables:', error);
  } finally {
    await client.end();
  }
}

checkTables();
