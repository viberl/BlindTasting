import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { vinaturelWines } from '../../db/schema';
import axios from 'axios';
import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the project root
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/blindtasting';
const client = postgres(connectionString);
const db = drizzle(client);

class VinaturelImporter {
  private static readonly API_BASE_URL = 'https://vinaturel.de/store-api';
  private static readonly API_KEY = 'SWSCT5QYLV9K9CQMJ_XI1Q176W';
  private static readonly BATCH_SIZE = 5;

  public static async testConnection(): Promise<boolean> {
    try {
      console.log('Testing API connection...');
      const response = await axios.get(
        `${this.API_BASE_URL}/product`,
        {
          headers: { 'sw-access-key': this.API_KEY },
          params: { limit: 1 },
          validateStatus: () => true
        }
      );
      return response.status === 200;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  private static extractVarietals(properties: any[]): string[] {
    if (!properties) return [];
    
    // Finde alle Rebsorten-Eigenschaften
    const varietalProps = properties.filter(prop => {
      const groupName = prop.group?.name || prop.group?.translated?.name || '';
      return groupName.toLowerCase().includes('rebsorte') || 
             groupName.toLowerCase().includes('traubensorte') ||
             groupName.toLowerCase().includes('varietät');
    });

    // Extrahiere die Namen der Rebsorten
    const varietals = varietalProps.flatMap(prop => {
      // Wenn die Eigenschaft ein Array von Werten hat
      if (Array.isArray(prop)) {
        return prop.map(p => p.name || p.translated?.name || '');
      }
      // Ansonsten nimm den direkten Namen
      return [prop.name || prop.translated?.name || ''];
    });

    // Entferne leere Einträge und Duplikate
    return [...new Set(varietals.filter(Boolean))];
  }

  private static getPropertyValue(properties: any[], groupName: string): string | null {
    if (!properties) return null;
    const prop = properties.find((p: any) => 
      (p.group?.name === groupName || p.group?.translated?.name === groupName) && 
      (p.name || p.translated?.name)
    );
    return prop ? (prop.name || prop.translated?.name) : null;
  }

  private static async makeApiRequest(page: number, limit: number): Promise<any> {
    try {
      const response = await axios.get(
        `${this.API_BASE_URL}/product`,
        {
          headers: { 
            'sw-access-key': this.API_KEY,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          params: {
            page,
            limit,
            'associations[manufacturer][]': 'name',
            'associations[properties][]': 'group',
            'associations[cover][]': 'media',
            'associations[seoUrls][]': 'pathInfo'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error(`API request failed for page ${page}:`, error);
      throw error;
    }
  }

  private static async processProducts(products: any[]): Promise<{processedCount: number, skippedVariantenCount: number}> {
    let processedCount = 0;
    let skippedVariantenCount = 0;
    
    for (const product of products) {
      try {
        // Überspringe Produkte mit 'VARIANTEN_' in der Artikelnummer
        if (product.productNumber && product.productNumber.startsWith('VARIANTEN_')) {
          console.log(`Überspringe Variante: ${product.productNumber} - ${product.name}`);
          skippedVariantenCount++;
          continue;
        }
        
        const properties = product.properties || [];
        const varietals = this.extractVarietals(properties);
        
        // Extract year from properties
        const yearProp = properties.find((p: any) => 
          (p.group?.name === 'Jahrgang' || p.group?.translated?.name === 'Jahrgang') && 
          (p.name || p.translated?.name)
        );
        
        const vintage = yearProp ? 
          parseInt(yearProp.name || yearProp.translated?.name || '0') : 
          new Date().getFullYear();
        
        const wineData = {
          externalId: product.id,
          producer: product.manufacturer?.name || product.manufacturer?.translated?.name || 'Unknown',
          name: product.translated?.name || product.name || 'Unnamed',
          country: this.getPropertyValue(properties, 'Land') || 'Unknown',
          region: this.getPropertyValue(properties, 'Region') || 'Unknown',
          vintage: isNaN(vintage) ? new Date().getFullYear() : vintage,
          volumeMl: parseInt(this.getPropertyValue(properties, 'Volumen in ml') || '0') || null,
          varietal1: varietals[0] || null,
          varietal2: varietals[1] || null,
          varietal3: varietals[2] || null,
          articleNumber: product.productNumber || '',
          productUrl: product.seoUrls?.[0]?.seoPathInfo 
            ? `https://vinaturel.de/detail/${product.seoUrls[0].seoPathInfo}`
            : null,
          imageUrl: product.cover?.media?.url || product.cover?.url || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await db.insert(vinaturelWines)
          .values(wineData)
          .onConflictDoUpdate({
            target: vinaturelWines.externalId,
            set: {
              name: wineData.name,
              producer: wineData.producer,
              country: wineData.country,
              region: wineData.region,
              vintage: wineData.vintage,
              articleNumber: wineData.articleNumber,
              varietal1: wineData.varietal1,
              varietal2: wineData.varietal2,
              varietal3: wineData.varietal3,
              volumeMl: wineData.volumeMl,
              productUrl: wineData.productUrl,
              imageUrl: wineData.imageUrl,
              updatedAt: wineData.updatedAt
            }
          });

        processedCount++;
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
      }
    }
    
    return { processedCount, skippedVariantenCount };
  }

  public static async importWines(): Promise<number> {
    if (!VinaturelImporter.API_KEY) {
      console.error('❌ VINATUREL_API_KEY is not set');
      process.exit(1);
    }
    
    // Test connection first
    const connected = await VinaturelImporter.testConnection();
    if (!connected) {
      console.error('❌ Failed to connect to API. Exiting.');
      process.exit(1);
    }

    try {
      console.log('🚀 Starting product import...');
      
      const pageSize = 100;
      let currentPage = 1;
      let totalImported = 0;
      let hasMore = true;

      while (hasMore) {
        console.log(`📄 Fetching page ${currentPage}...`);
        
        const response = await this.makeApiRequest(currentPage, pageSize);
        const products = response.elements || [];
        
        if (products.length === 0) {
          hasMore = false;
          break;
        }

        const {processedCount, skippedVariantenCount} = await this.processProducts(products);
        totalImported += processedCount;
        
        console.log(`Processed ${processedCount} products, skipped ${skippedVariantenCount} variant products`);
        
        if (products.length < pageSize) {
          hasMore = false;
        } else {
          currentPage++;
          
          // Add a small delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`🎉 Successfully imported/updated ${totalImported} wines`);
      return totalImported;
      
    } catch (error) {
      console.error('❌ Error during import:', error);
      throw error;
    }
  }
}

// Run the importer
async function main() {
  try {
    await VinaturelImporter.importWines();
    console.log('✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

main();
