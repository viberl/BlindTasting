-- Create vinaturel_wines table
CREATE TABLE IF NOT EXISTS vinaturel_wines (
  id SERIAL PRIMARY KEY,
  producer TEXT NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  vintage INTEGER NOT NULL,
  varietals JSONB NOT NULL DEFAULT '[]'::jsonb,
  external_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for search performance
CREATE INDEX IF NOT EXISTS idx_vinaturel_wines_search ON vinaturel_wines 
USING GIN (to_tsvector('german', producer || ' ' || name || ' ' || region || ' ' || country));

-- Create index on external_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_vinaturel_wines_external_id ON vinaturel_wines(external_id);
