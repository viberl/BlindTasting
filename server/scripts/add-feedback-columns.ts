import { db, pool } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.execute(sql`ALTER TABLE "tastings" ADD COLUMN IF NOT EXISTS "show_rating_field" boolean DEFAULT true NOT NULL`);
    await db.execute(sql`ALTER TABLE "tastings" ADD COLUMN IF NOT EXISTS "show_notes_field" boolean DEFAULT true NOT NULL`);
    console.log('Feedback columns ensured on tastings table.');
  } catch (error) {
    console.error('Failed to add feedback columns:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
