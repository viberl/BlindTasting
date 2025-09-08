import { sql } from 'drizzle-orm';

export async function up(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vinaturel_wines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      external_id TEXT NOT NULL,
      article_number TEXT,
      producer TEXT NOT NULL,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      region TEXT NOT NULL,
      vintage INTEGER NOT NULL,
      varietals TEXT[] NOT NULL,
      product_url TEXT,
      image_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS vinaturel_wines_external_id_idx ON vinaturel_wines (external_id);
  `);
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE IF EXISTS vinaturel_wines;`);
}
