-- Add article_number column to vinaturel_wines table
ALTER TABLE vinaturel_wines ADD COLUMN IF NOT EXISTS article_number TEXT;

-- Create index on article_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_vinaturel_wines_article_number ON vinaturel_wines(article_number);
