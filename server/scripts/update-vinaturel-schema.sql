-- Füge fehlende Spalten zur vinaturel_wines Tabelle hinzu
ALTER TABLE vinaturel_wines 
ADD COLUMN IF NOT EXISTS volume_ml INTEGER,
ADD COLUMN IF NOT EXISTS product_url TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS varietal_1 TEXT,
ADD COLUMN IF NOT EXISTS varietal_2 TEXT,
ADD COLUMN IF NOT EXISTS varietal_3 TEXT;
