import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field.trim()); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (field.length > 0 || cur.length > 0) { cur.push(field.trim()); field = ''; rows.push(cur); cur = []; }
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field.trim()); rows.push(cur); }
  return rows;
}

export async function importVinaturelFromCsv(exportUrl?: string): Promise<number> {
  const url = exportUrl || process.env.VINATUREL_EXPORT_URL;
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/blindtasting';
  if (!url) throw new Error('VINATUREL_EXPORT_URL is not set');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download CSV: ${res.status}`);
  const csvText = await res.text();
  const rows = parseCSV(csvText);
  if (rows.length === 0) return 0;
  const header = rows[0].map(h => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const iSku = idx('product_number');
  const iManufacturer = idx('manufacturer');
  const iName = idx('name');
  const iYear = idx('year');
  const iRegion = idx('region');
  const iCountry = idx('country');
  const iG1 = idx('grapes_1');
  const iG2 = idx('grapes_2');
  const iG3 = idx('grapes_3');
  const iLink = idx('target_url') >= 0 ? idx('target_url') : idx('link');
  const iImage = idx('image');
  const iUnit = idx('unit_pricing_measure');

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();
  let imported = 0;
  try {
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const sku = row[iSku];
      const producer = row[iManufacturer] || '';
      const name = row[iName] || '';
      const year = row[iYear] ? parseInt(row[iYear]) || 0 : 0;
      const region = row[iRegion] || '';
      const country = row[iCountry] || '';
      const varietal1 = row[iG1] || null;
      const varietal2 = row[iG2] || null;
      const varietal3 = row[iG3] || null;
      const productUrl = row[iLink] || null;
      const imageUrl = row[iImage] || null;
      const volumeMl = row[iUnit] ? parseInt(row[iUnit]) || null : null;
      if (!sku || !name) continue;

      await client.query(
        `INSERT INTO vinaturel_wines (external_id, article_number, producer, name, country, region, vintage, volume_ml, varietal_1, varietal_2, varietal_3, product_url, image_url, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW(), NOW())
         ON CONFLICT (external_id) DO UPDATE SET
           article_number=EXCLUDED.article_number,
           producer=EXCLUDED.producer,
           name=EXCLUDED.name,
           country=EXCLUDED.country,
           region=EXCLUDED.region,
           vintage=EXCLUDED.vintage,
           volume_ml=EXCLUDED.volume_ml,
           varietal_1=EXCLUDED.varietal_1,
           varietal_2=EXCLUDED.varietal_2,
           varietal_3=EXCLUDED.varietal_3,
           product_url=EXCLUDED.product_url,
           image_url=EXCLUDED.image_url,
           updated_at=NOW()`,
        [sku, sku, producer, name, country, region, year, volumeMl, varietal1, varietal2, varietal3, productUrl, imageUrl]
      );
      imported++;
    }
    return imported;
  } finally {
    client.release();
    await pool.end();
  }
}

