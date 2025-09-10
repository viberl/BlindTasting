import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in environment variables');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Read all migration files
    const migrationsDir = path.join(__dirname, '../drizzle/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    // Create migrations table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Get already run migrations
    const runMigrations = await db.execute<{ name: string }>(sql`
      SELECT name FROM _migrations ORDER BY id;
    `);

    const runMigrationNames = new Set(runMigrations.rows.map(m => m.name));
    let appliedMigrations = 0;

    // Baseline: if nothing recorded but core tables already exist, mark existing migrations as applied
    if (runMigrationNames.size === 0) {
      const coreTable = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'tastings'
        ) as exists;
      `);
      const hasSchema = coreTable.rows?.[0]?.exists === true;
      if (hasSchema) {
        console.log('Existing schema detected. Seeding _migrations baseline...');
        for (const file of migrationFiles) {
          // Keep the cascade migration to be applied; baseline the rest
          if (file.includes('enable_cascade_deletes')) continue;
          await db.execute(sql`INSERT INTO _migrations (name) VALUES (${file});`);
          runMigrationNames.add(file);
        }
      }
    }

    // Run new migrations
    for (const file of migrationFiles) {
      if (!runMigrationNames.has(file)) {
        console.log(`Running migration: ${file}`);
        const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        // Run in a transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(migration);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          appliedMigrations++;
          console.log(`Migration ${file} applied successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`Error applying migration ${file}:`, error);
          throw error;
        } finally {
          client.release();
        }
      }
    }

    console.log(`\nMigrations completed. Applied ${appliedMigrations} new migrations.`);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
