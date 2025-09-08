-- Add image_url column to wines table
ALTER TABLE wines ADD COLUMN IF NOT EXISTS image_url text;
