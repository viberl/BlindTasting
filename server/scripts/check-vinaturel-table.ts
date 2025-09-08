import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/blindtasting';
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  try {
    const countRes = await db.execute(sql`SELECT COUNT(*)::int AS count FROM vinaturel_wines`);
    const count = (countRes.rows?.[0] as any)?.count ?? 0;
    console.log(`vinaturel_wines rows: ${count}`);

    const colsRes = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'vinaturel_wines' ORDER BY column_name`);
    console.log('vinaturel_wines columns:', colsRes.rows.map((r: any) => r.column_name));

    if (count > 0) {
      const sample = await db.execute(sql`SELECT id, producer, name, country, region, vintage FROM vinaturel_wines LIMIT 5`);
      console.log('Sample rows:', sample.rows);
    }
  } catch (e) {
    console.error('Error checking vinaturel_wines:', e);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

