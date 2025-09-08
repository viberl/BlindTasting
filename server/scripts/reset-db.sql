-- Drop the existing table if it exists
DROP TABLE IF EXISTS vinaturel_wines;

-- Create the table with the correct schema
CREATE TABLE vinaturel_wines (
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
);

-- Create an index on the external_id for faster lookups
CREATE INDEX idx_vinaturel_wines_external_id ON vinaturel_wines(external_id);
