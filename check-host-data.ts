import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import 'dotenv/config';
import { users, tastings } from './shared/schema';

async function checkHostData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // 1. Check users table
    console.log('\nChecking users table...');
    const usersResult = await client.query('SELECT id, name, email FROM users LIMIT 10');
    console.log('First 10 users:');
    console.table(usersResult.rows);
    
    // 2. Check tastings table with host information
    console.log('\nChecking tastings table...');
    const tastingsResult = await client.query(`
      SELECT t.id, t.name, t.host_id, u.name as host_name, u.email as host_email
      FROM tastings t
      LEFT JOIN users u ON t.host_id = u.id
      LIMIT 10
    `);
    
    console.log('First 10 tastings with host info:');
    console.table(tastingsResult.rows);
    
    // 3. Check for tastings with missing host info
    console.log('\nChecking for tastings with missing host info...');
    const missingHosts = await client.query(`
      SELECT t.id, t.name, t.host_id
      FROM tastings t
      LEFT JOIN users u ON t.host_id = u.id
      WHERE u.id IS NULL
      LIMIT 10
    `);
    
    if (missingHosts.rows.length > 0) {
      console.log(`Found ${missingHosts.rows.length} tastings with missing host info:`);
      console.table(missingHosts.rows);
    } else {
      console.log('No tastings with missing host info found.');
    }
    
  } catch (error) {
    console.error('Error checking host data:', error);
  } finally {
    await client.end();
  }
}

checkHostData();
