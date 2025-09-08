import axios from 'axios';
import { db, pool } from '../db';
import { vinaturelWines } from '../models/vinaturel-wine.model';
import { ilike, or, sql, and, eq, SQL } from 'drizzle-orm';

interface WineSearchResult {
  id: number;
  producer: string;
  name: string;
  country: string;
  region: string;
  vintage: number;
  varietals: string[];
  externalId: string;
  articleNumber: string | null;
  productUrl: string | null;
  imageUrl: string | null;
  volumeMl: number | null;
  varietal1: string | null;
  varietal2: string | null;
  varietal3: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export class VinaturelService {
  private static readonly API_BASE_URL = 'https://vinaturel.de/api';
  private static readonly API_KEY = process.env.VINATUREL_API_KEY; // Make sure to set this in your .env

  public static async importWines(): Promise<{ count: number }> {
    try {
      // First, fetch all wines from Vinaturel API
      const response = await axios.get(`${this.API_BASE_URL}/wines`, {
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`
        }
      });

      const wines = response.data;
      let importedCount = 0;

      // Process each wine and save to database
      for (const wine of wines) {
        try {
          await db.insert(vinaturelWines)
            .values({
              producer: wine.producer,
              name: wine.name,
              country: wine.country,
              region: wine.region,
              vintage: parseInt(wine.vintage) || 0,
              varietals: wine.varietals || [],
              externalId: wine.id.toString(),
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .onConflictDoUpdate({
              target: vinaturelWines.externalId,
              set: {
                producer: wine.producer,
                name: wine.name,
                country: wine.country,
                region: wine.region,
                vintage: parseInt(wine.vintage) || 0,
                varietals: wine.varietals || [],
                updatedAt: new Date()
              }
            });
          
          importedCount++;
        } catch (error) {
          console.error(`Error importing wine ${wine.id}:`, error);
        }
      }

      return { count: importedCount };
    } catch (error) {
      console.error('Error importing wines from Vinaturel:', error);
      throw new Error('Failed to import wines from Vinaturel');
    }
  }

  public static async searchWines(query: string): Promise<{ data: any[] }> {
    try {
      console.log(`[VinaturelService] Starting search for query: ${query}`);
      
      if (!query || typeof query !== 'string' || query.trim() === '') {
        console.log('[VinaturelService] Empty or invalid query, returning empty array');
        return { data: [] };
      }
      
      const searchTerm = `%${query}%`;
      const isArticleLike = /^[A-Za-z0-9\-]+$/.test(query.trim());
      
      // If it looks like an Artikelnummer/ID, try exact match first
      if (isArticleLike) {
        try {
          const exact = await db.execute(sql`
            SELECT 
              id,
              external_id as "externalId",
              article_number as "articleNumber",
              producer,
              name,
              country,
              region,
              vintage,
              volume_ml as "volumeMl",
              varietal_1 as "varietal1",
              varietal_2 as "varietal2",
              varietal_3 as "varietal3",
              product_url as "productUrl",
              image_url as "imageUrl",
              created_at as "createdAt",
              updated_at as "updatedAt"
            FROM vinaturel_wines
            WHERE external_id = ${query} OR article_number = ${query}
            LIMIT 50
          `);
          if (exact.rows?.length) {
            const wines = exact.rows.map((row: any) => ({
              ...row,
              varietal1: row.varietal1 || null,
              varietal2: row.varietal2 || null,
              varietal3: row.varietal3 || null,
              varietals: [row.varietal1, row.varietal2, row.varietal3].filter(Boolean),
            }));
            console.log(`[VinaturelService] Exact article match found ${wines.length} results`);
            return { data: wines };
          }
        } catch (e) {
          console.warn('[VinaturelService] Exact match query failed, falling back to LIKE');
        }
      }

      console.log('[VinaturelService] Executing database query...');

      // Prüfe vorhandene Spalten, um ältere Tabellen-Schemata abzufangen
      const colsRes = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'vinaturel_wines'
      `);
      const cols = (colsRes.rows as any[]).map((r) => r.column_name as string);
      const hasExternalId = cols.includes('external_id');
      const hasSku = cols.includes('sku');
      const hasArticleNumber = cols.includes('article_number');
      const hasVolumeMl = cols.includes('volume_ml');
      const hasVarietal1 = cols.includes('varietal_1');
      const hasVarietal2 = cols.includes('varietal_2');
      const hasVarietal3 = cols.includes('varietal_3');
      const hasProductUrl = cols.includes('product_url');
      const hasImageUrl = cols.includes('image_url');

      let result;
      try {
        result = await db.execute(sql`
          SELECT 
            id,
            ${(hasExternalId ? sql`external_id` : (hasSku ? sql`sku` : sql`NULL::text`))} as "externalId",
            ${hasArticleNumber ? sql`article_number` : sql`NULL::text`} as "articleNumber",
            producer,
            name,
            country,
            region,
            vintage,
            ${hasVolumeMl ? sql`volume_ml` : sql`NULL::integer`} as "volumeMl",
            ${hasVarietal1 ? sql`varietal_1` : sql`NULL::text`} as "varietal1",
            ${hasVarietal2 ? sql`varietal_2` : sql`NULL::text`} as "varietal2",
            ${hasVarietal3 ? sql`varietal_3` : sql`NULL::text`} as "varietal3",
            ${hasProductUrl ? sql`product_url` : sql`NULL::text`} as "productUrl",
            ${hasImageUrl ? sql`image_url` : sql`NULL::text`} as "imageUrl",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM 
            vinaturel_wines
          WHERE 
            LOWER(producer) LIKE LOWER(${searchTerm}) OR
            LOWER(name) LIKE LOWER(${searchTerm}) OR
            LOWER(region) LIKE LOWER(${searchTerm}) OR
            LOWER(country) LIKE LOWER(${searchTerm}) OR
            external_id ILIKE ${searchTerm} OR
            article_number ILIKE ${searchTerm}
          LIMIT 50
        `);
      } catch (e) {
        // Fallback: minimal Spaltenauswahl ohne optionale Felder
        console.warn('[VinaturelService] Primary query failed, running minimal fallback query');
        result = await db.execute(sql`
          SELECT 
            id,
            NULL::text as "externalId",
            NULL::text as "articleNumber",
            producer,
            name,
            country,
            region,
            vintage,
            NULL::integer as "volumeMl",
            NULL::text as "varietal1",
            NULL::text as "varietal2",
            NULL::text as "varietal3",
            NULL::text as "productUrl",
            NULL::text as "imageUrl",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM 
            vinaturel_wines
          WHERE 
            LOWER(producer) LIKE LOWER(${searchTerm}) OR
            LOWER(name) LIKE LOWER(${searchTerm}) OR
            LOWER(region) LIKE LOWER(${searchTerm}) OR
            LOWER(country) LIKE LOWER(${searchTerm}) OR
            external_id ILIKE ${searchTerm} OR
            article_number ILIKE ${searchTerm}
          LIMIT 50
        `);
      }
      
      console.log(`[VinaturelService] Found ${result.rows.length} results`);

      // If nothing found, try a strict lookup by article/external id using node-postgres directly
      if (!result.rows || result.rows.length === 0) {
        try {
          const strict = await pool.query(
            `SELECT 
              id,
              external_id as "externalId",
              article_number as "articleNumber",
              producer,
              name,
              country,
              region,
              vintage,
              volume_ml as "volumeMl",
              varietal_1 as "varietal1",
              varietal_2 as "varietal2",
              varietal_3 as "varietal3",
              product_url as "productUrl",
              image_url as "imageUrl",
              created_at as "createdAt",
              updated_at as "updatedAt"
            FROM vinaturel_wines
            WHERE external_id = $1 OR article_number = $1
            LIMIT 50`,
            [query]
          );
          if (strict.rows && strict.rows.length > 0) {
            console.log(`[VinaturelService] Strict lookup found ${strict.rows.length} results`);
            const wines = strict.rows.map((row: any) => ({
              ...row,
              varietal1: row.varietal1 || null,
              varietal2: row.varietal2 || null,
              varietal3: row.varietal3 || null,
              varietals: [row.varietal1, row.varietal2, row.varietal3].filter(Boolean),
            }));
            return { data: wines };
          }
        } catch (e) {
          console.warn('[VinaturelService] Strict lookup failed:', e);
        }
      }
      
      // Return the results in the expected format for the frontend
      const wines = result.rows.map((row: any) => {
        // Ensure we have valid values for all required fields
        const wineData = {
          ...row,
          // Handle NULL values in varietals
          varietal1: row.varietal1 || null,
          varietal2: row.varietal2 || null,
          varietal3: row.varietal3 || null,
          // Create varietals array, filtering out any null/undefined values
          varietals: [
            row.varietal1,
            row.varietal2,
            row.varietal3
          ].filter(Boolean)
        };
        
        console.log('Processed wine data:', wineData);
        return wineData;
      });
      
      console.log('[VinaturelService] Search completed successfully');
      return { data: wines };
    } catch (error) {
      console.error('[VinaturelService] Error searching wines:', error);
      if (error instanceof Error) {
        console.error('[VinaturelService] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      throw new Error(`Failed to search wines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
