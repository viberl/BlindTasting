import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { vinaturelWines } from '../models/vinaturel-wine.model';
import axios from 'axios';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '../../.env' });

// Create a database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/blindtasting',
});

// Create a Drizzle instance
export const db = drizzle(pool);

// Define the wine data type
interface WineData {
  producer: string;
  name: string;
  country: string;
  region: string;
  vintage: number;
  varietals: string[];
  externalId: string;
  articleNumber: string;
  productUrl?: string | null;
  imageUrl?: string | null;
}

class VinaturelImporter {
  private static readonly API_BASE_URL = 'https://vinaturel.de/store-api';
  private static readonly API_KEY = process.env.VINATUREL_API_KEY;
  private static readonly BATCH_SIZE = 10;

  public static async importWines(): Promise<void> {
    if (!this.API_KEY) {
      throw new Error('VINATUREL_API_KEY is not set in environment variables');
    }

    console.log('🚀 Starting wine import process...');
    let page = 1;
    let hasMore = true;
    let totalImported = 0;

    try {
      while (hasMore) {
        console.log(`📄 Fetching page ${page}...`);
        const products = await this.fetchProducts(page);
        
        if (!products || products.length === 0) {
          console.log('ℹ️ No more products to process');
          hasMore = false;
          break;
        }

        console.log(`🔄 Processing ${products.length} products...`);
        const importedCount = await this.processProducts(products);
        totalImported += importedCount;

        console.log(`✅ Processed page ${page}. Imported/Updated ${importedCount} products`);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        page++;
      }

      console.log(`\n🎉 Import completed! Total products imported/updated: ${totalImported}`);
    } catch (error) {
      console.error('❌ Error during import:', error);
      throw error;
    }
  }

  private static async fetchProducts(page: number): Promise<any[]> {
    try {
      const response = await axios.get(`${this.API_BASE_URL}/product`, {
        headers: {
          'Content-Type': 'application/json',
          'sw-access-key': this.API_KEY,
        },
        params: {
          limit: this.BATCH_SIZE,
          page,
          'includes[product]': 'id,productNumber,name,manufacturer,country,cover,seoUrls',
        },
      });

      return (response as any).data?.data || [];
    } catch (error: unknown) {
      const err: any = error;
      console.error(`❌ Error fetching products (page ${page}):`, err?.response?.data || err?.message || String(err));
      throw error as any;
    }
  }

  private static async processProducts(products: any[]): Promise<number> {
    let importedCount = 0;

    for (const product of products) {
      try {
        const productData = this.extractProductData(product);
        if (!productData) continue;

        await this.upsertProduct(productData);
        importedCount++;
      } catch (error: unknown) {
        const err: any = error;
        console.error(`❌ Error processing product ${product.id}:`, err?.message || String(err));
      }
    }

    return importedCount;
  }

  private static extractProductData(product: any): WineData | null {
    try {
      if (!product || !product.id) return null;

      const producer = product.manufacturer?.name || 'Unbekannt';
      const name = product.name || 'Unbekannter Wein';
      const country = product.country?.name || 'Unbekannt';
      const region = product.customFields?.region || 'Unbekannt';
      const vintage = product.releaseDate ? new Date(product.releaseDate).getFullYear() : 0;
      const varietals = this.extractVarietals(product.properties || []);
      
      const productUrl = product.seoUrls?.[0]?.seoPathInfo
        ? `https://vinaturel.de/${product.seoUrls[0].seoPathInfo}`
        : null;
      
      const imageUrl = product.cover?.media?.url || null;

      return {
        externalId: product.id,
        articleNumber: product.productNumber || '',
        producer,
        name,
        country,
        region,
        vintage,
        varietals,
        productUrl,
        imageUrl,
      };
    } catch (error) {
      console.error('Error extracting product data:', error);
      return null;
    }
  }

  private static extractVarietals(properties: any[]): string[] {
    if (!Array.isArray(properties)) return [];
    return properties
      .filter(prop => prop.group?.name === 'Rebsorte' && prop.name)
      .map(prop => prop.name);
  }

  private static async upsertProduct(productData: WineData): Promise<void> {
    try {
      const existingProduct = await db
        .select()
        .from(vinaturelWines)
        .where(eq(vinaturelWines.externalId, productData.externalId));

      if (existingProduct && existingProduct.length > 0) {
        await db
          .update(vinaturelWines)
          .set({
            producer: productData.producer,
            name: productData.name,
            country: productData.country,
            region: productData.region,
            vintage: productData.vintage,
            varietals: productData.varietals,
            articleNumber: productData.articleNumber,
            updatedAt: new Date(),
          })
          .where(eq(vinaturelWines.externalId, productData.externalId));
        console.log(`🔄 Updated product: ${productData.name} (${productData.externalId})`);
      } else {
        await db.insert(vinaturelWines).values({
          producer: productData.producer,
          name: productData.name,
          country: productData.country,
          region: productData.region,
          vintage: productData.vintage,
          varietals: productData.varietals,
          externalId: productData.externalId,
          articleNumber: productData.articleNumber,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`✅ Imported product: ${productData.name} (${productData.externalId})`);
      }
    } catch (error: unknown) {
      const err: any = error;
      console.error(`❌ Database error for product ${productData.externalId}:`, err?.message || String(err));
      throw error as any;
    }
  }
}

// Run the importer
async function main() {
  try {
    await VinaturelImporter.importWines();
    console.log('✅ Script completed successfully');
    process.exit(0);
  } catch (error: unknown) {
    const err: any = error;
    console.error('❌ Script failed:', err?.message || String(err));
    process.exit(1);
  }
}

main();
