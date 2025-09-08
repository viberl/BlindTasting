import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';
import { sql } from 'drizzle-orm';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Create a database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/blindtasting',
});

const db = drizzle(pool);

async function runMigrations() {
  // Create migrations table if it doesn't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Get all migrations that have already been run
  const { rows: completedMigrations } = await db.execute<{ name: string }>(
    sql`SELECT name FROM _migrations ORDER BY name`
  );

  const completedMigrationNames = new Set(completedMigrations.map(m => m.name));

  // Read all migration files
  const migrationDir = path.join(__dirname, '../migrations');
  const files = (await readdir(migrationDir))
    .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort();

  // Run migrations that haven't been run yet
  for (const file of files) {
    if (!completedMigrationNames.has(file)) {
      console.log(`Running migration: ${file}`);
      try {
        const migration = await import(`../migrations/${file}`);
        await migration.up(db);
        
        // Record the migration as completed
        await db.execute(
          sql`INSERT INTO _migrations (name) VALUES (${file})`
        );
        console.log(`✅ Successfully ran migration: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to run migration ${file}:`, error);
        process.exit(1);
      }
    }
  }

  console.log('All migrations completed successfully');
  process.exit(0);
}

runMigrations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
