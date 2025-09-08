import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { vinaturelWines } from '../models/vinaturel-wine.model';
import axios from 'axios';
import dotenv from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

console.log('Environment config:', {
  NODE_ENV: process.env.NODE_ENV,
  VINATUREL_API_URL: process.env.VINATUREL_API_URL,
  DB_URL: process.env.DATABASE_URL ? 'set' : 'not set',
  __dirname
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/blindtasting'
});

const db: NodePgDatabase = drizzle(pool);

interface WineData {
  id?: number;
  producer: string;
  name: string;
  country: string;
  region: string;
  vintage: number;
  varietals: string[];
  externalId: string;
  articleNumber?: string;
  imageUrl?: string | null;
  productUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class VinaturelImporter {
  private static readonly API_BASE_URL = 'https://vinaturel.de/api';
  private static readonly API_KEY = process.env.VINATUREL_API_KEY || '';

  static async importWines() {
    try {
      console.log('Fetching wines from Vinaturel API...');
      
      // Validate configuration
      if (!this.API_KEY) {
        throw new Error('VINATUREL_API_KEY is not set in .env file');
      }

      const response = await axios.get(`${this.API_BASE_URL}/product`, {
        headers: {
          'Content-Type': 'application/json',
          'sw-access-key': this.API_KEY,
          'Authorization': `Bearer ${this.API_KEY}`
        }
      });

      const products = response.data;
      console.log(`Found ${products.length} products to import`);

      let created = 0;
      let updated = 0;
      let errors = 0;

      await this.checkDatabaseSchema();

      for (const product of products) {
        try {
          const wineData = this.prepareWineData(product);
          await this.upsertWine(wineData);
          product.id ? updated++ : created++;
        } catch (error) {
          console.error(`Error processing product ${product.id}:`, error);
          errors++;
        }
      }

      console.log(`\nImport completed:`);
      console.log(`- Imported: ${created} wines`);
      console.log(`- Updated: ${updated} wines`);
      console.log(`- Errors: ${errors} wines`);

      return { created, updated, errors };
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  private static async checkDatabaseSchema() {
    try {
      const tableExists = await db.execute<{exists: boolean}>(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'vinaturel_wines'
        ) as "exists"
      `);

      if (!tableExists.rows[0].exists) {
        throw new Error('vinaturel_wines table does not exist');
      }
    } catch (error) {
      console.error('Database schema check failed:', error);
      throw error;
    }
  }

  private static prepareWineData(product: any): WineData {
    return {
      producer: product.manufacturer?.name || '',
      name: product.name || '',
      country: product.customFields?.country || '',
      region: product.customFields?.region || '',
      vintage: product.customFields?.vintage || 0,
      varietals: product.customFields?.varietals || [],
      externalId: product.id || '',
      articleNumber: product.productNumber || '',
      imageUrl: product.cover?.media?.url || null,
      productUrl: product.seoUrls?.[0]?.seoPathInfo || null,
      updatedAt: new Date()
    };
  }

  private static async upsertWine(wineData: WineData) {
    const existing = await db
      .select()
      .from(vinaturelWines)
      .where(eq(vinaturelWines.externalId, wineData.externalId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(vinaturelWines)
        .set(wineData)
        .where(eq(vinaturelWines.externalId, wineData.externalId));
    } else {
      await db.insert(vinaturelWines).values({
        ...wineData,
        createdAt: new Date()
      });
    }
  }
}

// Main execution
(async () => {
  try {
    await VinaturelImporter.importWines();
    console.log('✅ Import completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
})();
