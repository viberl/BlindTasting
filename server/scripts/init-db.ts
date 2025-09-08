import postgres from 'postgres';

export async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString);

  try {
    console.log('Dropping existing table...');
    await client`DROP TABLE IF EXISTS vinaturel_wines`;
    
    console.log('Creating table...');
    await client`
      CREATE TABLE IF NOT EXISTS vinaturel_wines (
        id SERIAL PRIMARY KEY,
        external_id TEXT NOT NULL UNIQUE,
        article_number TEXT,
        producer TEXT NOT NULL,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        region TEXT NOT NULL,
        vintage INTEGER NOT NULL,
        varietal_1 TEXT,
        varietal_2 TEXT,
        varietal_3 TEXT,
        product_url TEXT,
        image_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the initialization
initDatabase()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const err: any = error;
    console.error('Failed to initialize database:', err?.message || String(err));
    process.exit(1);
  });
