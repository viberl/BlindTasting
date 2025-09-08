"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const vinaturel_wine_model_1 = require("../models/vinaturel-wine.model");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const drizzle_orm_1 = require("drizzle-orm");
// Load environment variables
dotenv_1.default.config({ path: '../../.env' });
// Create a database connection pool
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/blindtasting',
});
// Create a Drizzle instance
exports.db = (0, node_postgres_1.drizzle)(pool);
class VinaturelImporter {
    static async importWines() {
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
        }
        catch (error) {
            console.error('❌ Error during import:', error);
            throw error;
        }
    }
    static async fetchProducts(page) {
        try {
            const response = await axios_1.default.get(`${this.API_BASE_URL}/product`, {
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
            return response.data?.data || [];
        }
        catch (error) {
            console.error(`❌ Error fetching products (page ${page}):`, error.response?.data || error.message);
            throw error;
        }
    }
    static async processProducts(products) {
        let importedCount = 0;
        for (const product of products) {
            try {
                const productData = this.extractProductData(product);
                if (!productData)
                    continue;
                await this.upsertProduct(productData);
                importedCount++;
            }
            catch (error) {
                console.error(`❌ Error processing product ${product.id}:`, error.message);
            }
        }
        return importedCount;
    }
    static extractProductData(product) {
        try {
            if (!product || !product.id)
                return null;
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
        }
        catch (error) {
            console.error('Error extracting product data:', error);
            return null;
        }
    }
    static extractVarietals(properties) {
        if (!Array.isArray(properties))
            return [];
        return properties
            .filter(prop => prop.group?.name === 'Rebsorte' && prop.name)
            .map(prop => prop.name);
    }
    static async upsertProduct(productData) {
        try {
            const existingProduct = await exports.db
                .select()
                .from(vinaturel_wine_model_1.vinaturelWines)
                .where((0, drizzle_orm_1.eq)(vinaturel_wine_model_1.vinaturelWines.externalId, productData.externalId));
            if (existingProduct && existingProduct.length > 0) {
                await exports.db
                    .update(vinaturel_wine_model_1.vinaturelWines)
                    .set({
                    ...productData,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(vinaturel_wine_model_1.vinaturelWines.externalId, productData.externalId));
                console.log(`🔄 Updated product: ${productData.name} (${productData.externalId})`);
            }
            else {
                await exports.db.insert(vinaturel_wine_model_1.vinaturelWines).values({
                    ...productData,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                console.log(`✅ Imported product: ${productData.name} (${productData.externalId})`);
            }
        }
        catch (error) {
            console.error(`❌ Database error for product ${productData.externalId}:`, error.message);
            throw error;
        }
    }
}
VinaturelImporter.API_BASE_URL = 'https://vinaturel.de/store-api';
VinaturelImporter.API_KEY = process.env.VINATUREL_API_KEY;
VinaturelImporter.BATCH_SIZE = 10;
// Run the importer
async function main() {
    try {
        await VinaturelImporter.importWines();
        console.log('✅ Script completed successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
}
main();
