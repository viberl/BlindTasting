import { db } from "./db";
import { eq } from "drizzle-orm";
import { wines } from "@shared/schema";
import { storage } from "./storage";
import { VinaturelAPI } from "./vinaturel-api";
import dotenv from "dotenv";
dotenv.config();

interface ShopwareProduct {
  id: string;
  productNumber: string;
  name: string;
  manufacturer: { name: string };
  customFields?: Record<string, any>;
}

async function fetchAllVinaturelProducts(): Promise<ShopwareProduct[]> {
  let page = 1;
  const limit = 100;
  let hasMore = true;
  const allProducts: ShopwareProduct[] = [];

  while (hasMore) {
    const resp = await fetch(
      `${process.env.SHOPWARE_API_URL}/store-api/product?page=${page}&limit=${limit}`,
      {
        headers: {
          'sw-access-key': process.env.SHOPWARE_ACCESS_KEY || '',
          'Content-Type': 'application/json',
        },
      }
    );
    if (!resp.ok) throw new Error(`Shopware API error: ${resp.status}`);
    const data = await resp.json();
    const products = data.elements as ShopwareProduct[];
    allProducts.push(...products);
    hasMore = products.length === limit;
    page++;
  }
  return allProducts;
}

function extractVinaturelFields(product: ShopwareProduct) {
  return {
    productNumber: product.productNumber,
    name: product.name,
    grapeVariety: product.customFields?.vinaturel_rebsorte || null,
    region: product.customFields?.vinaturel_region || null,
    winery: product.manufacturer?.name || null,
    vintage: product.customFields?.vinaturel_jahrgang || null,
  };
}

async function upsertWine(product: ShopwareProduct) {
  // Prüfe, ob es einen Wein mit dieser productNumber gibt
  const existing = await db.select().from(wines).where(eq(wines.vinaturelId, product.productNumber));
  const fields = extractVinaturelFields(product);
  // Mapping auf InsertWine mit expliziten Typen
  const insertWine: typeof wines.$inferInsert = {
    flightId: 1, // Dummy-Flight, anpassen je nach Use-Case
    letterCode: "-",
    country: "",
    region: fields.region || "",
    producer: fields.winery || "",
    name: fields.name || "",
    vintage: (fields.vintage || "").toString(),
    varietals: fields.grapeVariety ? [fields.grapeVariety] : [],
    vinaturelId: fields.productNumber,
    isCustom: false,
  };
  if (existing.length > 0) {
    await db.update(wines).set(insertWine).where(eq(wines.vinaturelId, product.productNumber));
    return "updated";
  } else {
    await storage.createWine(insertWine);
    return "created";
  }
}

async function main() {
  let created = 0;
  let updated = 0;
  const allProducts = await fetchAllVinaturelProducts();
  // Entferne die Tag-Filterung, importiere ALLE Produkte
  for (const product of allProducts) {
    const result = await upsertWine(product);
    if (result === "created") created++;
    if (result === "updated") updated++;
  }
  console.log(`Import abgeschlossen: ${created} Weine neu angelegt, ${updated} aktualisiert.`);
}

main().catch(e => {
  console.error("Fehler beim Import:", e);
  process.exit(1);
});
