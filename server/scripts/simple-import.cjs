const { Pool } = require('pg');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

async function ensureTableExists(client) {
  try {
    // Erstelle die Tabelle, falls sie nicht existiert
    await client.query(`
      CREATE TABLE IF NOT EXISTS vinaturel_wines (
        id SERIAL PRIMARY KEY,
        external_id TEXT UNIQUE NOT NULL,
        article_number TEXT,
        producer TEXT NOT NULL,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        region TEXT NOT NULL,
        vintage INTEGER NOT NULL,
        volume_ml INTEGER,
        varietal_1 TEXT,
        varietal_2 TEXT,
        varietal_3 TEXT,
        product_url TEXT,
        image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    // Füge die fehlenden Spalten hinzu, falls sie noch nicht existieren
    const columnsToAdd = [
      { name: 'volume_ml', type: 'INTEGER' },
      { name: 'product_url', type: 'TEXT' },
      { name: 'image_url', type: 'TEXT' },
      { name: 'varietal_1', type: 'TEXT' },
      { name: 'varietal_2', type: 'TEXT' },
      { name: 'varietal_3', type: 'TEXT' }
    ];

    for (const column of columnsToAdd) {
      try {
        await client.query(`
          ALTER TABLE vinaturel_wines 
          ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};
        `);
        console.log(`✅ Added column ${column.name} to vinaturel_wines`);
      } catch (error) {
        if (error.code === '42701') { // duplicate_column
          console.log(`ℹ️ Column ${column.name} already exists`);
        } else {
          console.error(`❌ Error adding column ${column.name}:`, error);
          throw error;
        }
      }
    }
    
    console.log('✅ Database table checked/created successfully');
  } catch (error) {
    console.error('❌ Error ensuring table exists:', error);
    throw error;
  }
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/blindtasting',
});

// API configuration
const API_BASE_URL = process.env.VINATUREL_API_URL || 'https://vinaturel.de/store-api';
const API_KEY = process.env.VINATUREL_API_KEY;
const BATCH_SIZE = 10;

if (!API_KEY) {
  console.error('❌ VINATUREL_API_KEY is not set in environment variables');
  process.exit(1);
}

async function fetchProducts(page) {
  try {
    console.log(`📄 Fetching page ${page}...`);
    // Fetch products with minimal parameters
    const url = new URL(`${API_BASE_URL}/product`);
    url.searchParams.append('limit', BATCH_SIZE);
    url.searchParams.append('page', page);
    
    console.log('Request URL:', url.toString());
    
    const response = await axios.get(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'sw-access-key': API_KEY,
        'Accept': 'application/json',
      },
      validateStatus: function (status) {
        return status >= 200 && status < 300; // Accept all 2xx status codes
      },
      timeout: 10000, // 10 seconds timeout
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', JSON.stringify(response.headers, null, 2));
    console.log('Response data sample:', JSON.stringify(response.data?.data?.[0] || response.data, null, 2));

    // Die API gibt die Produkte direkt im data-Array zurück, nicht in data.data
    return response.data?.elements || [];
  } catch (error) {
    console.error(`❌ Error fetching products (page ${page}):`, error.response?.data || error.message);
    throw error;
  }
}

function extractVarietals(propertyIds, allProperties) {
  if (!Array.isArray(propertyIds) || !Array.isArray(allProperties)) return [];
  
  // Finde die Eigenschaft mit dem Namen 'Rebsorte'
  const varietalGroup = allProperties.find(prop => 
    prop.translated?.name === 'Rebsorte' || prop.name === 'Rebsorte'
  );
  
  if (!varietalGroup || !varietalGroup.options) return [];
  
  // Filtere die Eigenschaften, die zu dieser Gruppe gehören
  return propertyIds
    .map(propId => {
      const prop = varietalGroup.options.find(opt => opt.id === propId);
      return prop?.name || null;
    })
    .filter(Boolean);
}

async function processProduct(product, allProperties) {
  if (!product || !product.id) return null;

  try {
    const producer = product.manufacturer?.name || 'Unbekannt';
    const name = product.translated?.name || product.name || 'Unbekannter Wein';
    
    console.log('\n🔍 Verarbeite Produkt:', product.id, name);
    
    // Extrahiere das Volumen in ml
    let volumeMl = null;
    
    // Versuche, das Volumen aus dem Namen zu extrahieren (z.B. "0,75l" oder "750ml")
    if (name) {
      const volumeMatch = name.match(/(\d+[.,]?\d*)\s*(ml|ML|mL|cl|CL|cL|l|L)/);
      if (volumeMatch) {
        let value = parseFloat(volumeMatch[1].replace(',', '.'));
        const unit = volumeMatch[2].toLowerCase();
        
        // Konvertiere in ml
        if (unit === 'l') {
          volumeMl = Math.round(value * 1000);
        } else if (unit === 'cl') {
          volumeMl = Math.round(value * 10);
        } else {
          volumeMl = Math.round(value);
        }
      }
    }
    
    // Extrahiere die Custom Fields
    const customFields = product.customFields || {};
    
    // Extrahiere Eigenschaften aus den Properties
    const properties = product.properties || [];
    const propertyMap = {};
    
    // Erstelle eine Map der Properties für einfachen Zugriff
    properties.forEach(prop => {
      if (prop.group && prop.group.name) {
        const groupName = prop.group.name.toLowerCase();
        propertyMap[groupName] = prop.name;
        
        // Debug-Ausgabe für spezielle Eigenschaften
        if (['land', 'herkunftsland', 'region', 'anbaugebiet', 'jahrgang', 'vintage', 'rebsorte', 'traubensorte'].includes(groupName)) {
          console.log(`Found property: ${groupName} = ${prop.name}`);
        }
      }
    });
    
    // Land aus Properties oder Custom Fields
    let country = propertyMap['land'] || 
                 propertyMap['herkunftsland'] ||
                 customFields.vinaturel_wine_analysis_country || 
                 customFields.country || 
                 'Unbekannt';
    
    console.log(`Land: ${country}`);
    
    // Region aus Properties oder Custom Fields
    let region = propertyMap['region'] || 
                propertyMap['anbaugebiet'] ||
                customFields.vinaturel_wine_analysis_region || 
                customFields.region || 
                'Unbekannt';
    
    console.log(`Region: ${region}`);
    
    // Jahrgang aus Properties, Custom Fields oder Namen extrahieren
    let vintage = 0;
    if (propertyMap['jahrgang'] || propertyMap['vintage']) {
      vintage = parseInt(propertyMap['jahrgang'] || propertyMap['vintage']) || 0;
      console.log(`Jahrgang aus Properties: ${vintage}`);
    } else if (customFields.vinaturel_wine_analysis_vintage || customFields.vintage) {
      vintage = parseInt(customFields.vinaturel_wine_analysis_vintage || customFields.vintage) || 0;
      console.log(`Jahrgang aus Custom Fields: ${vintage}`);
    } else {
      const yearMatch = name.match(/(19|20)\d{2}/);
      if (yearMatch) {
        vintage = parseInt(yearMatch[0]);
        console.log(`Jahrgang aus Namen extrahiert: ${vintage}`);
      }
    }
    
    // Rebsorten aus Properties oder Custom Fields
    const varietals = [];
    
    // Zuerst nach Rebsorten in den Properties suchen
    const varietalProperties = properties.filter(p => {
      if (!p.group || !p.group.name) return false;
      
      const groupName = p.group.name.toLowerCase();
      return groupName.includes('rebsorte') || 
             groupName.includes('traubensorte') ||
             groupName.includes('grape') ||
             groupName.includes('variety');
    });
    
    console.log(`Found ${varietalProperties.length} varietal properties`);
    
    // Rebsorten aus den Properties hinzufügen
    varietalProperties.forEach(prop => {
      if (prop.name) {
        // Teile den Namen bei Kommas auf und füge jede Rebsorte einzeln hinzu
        const varietalNames = prop.name.split(',').map(s => s.trim()).filter(Boolean);
        varietalNames.forEach(varietal => {
          if (!varietals.includes(varietal)) {
            varietals.push(varietal);
            console.log(`Added varietal from properties: ${varietal}`);
          }
        });
      }
    });
    
    // Falls keine Rebsorten in den Properties gefunden wurden, Custom Fields überprüfen
    if (varietals.length === 0) {
      console.log('No varietals found in properties, checking custom fields...');
      
      // Überprüfe die Standard-Custom-Fields
      const customVarietals = [
        customFields.vinaturel_wine_analysis_grape_variety,
        customFields.varietal,
        customFields.traubensorte,
        customFields.grape_variety
      ].filter(Boolean);
      
      customVarietals.forEach(varietal => {
        const varietalNames = String(varietal).split(',').map(s => s.trim()).filter(Boolean);
        varietalNames.forEach(v => {
          if (!varietals.includes(v)) {
            varietals.push(v);
            console.log(`Added varietal from custom fields: ${v}`);
          }
        });
      });
      
      // Überprüfe numerierte Varietals (varietal_1, varietal_2, etc.)
      for (let i = 1; i <= 5; i++) {
        const varietal = customFields[`vinaturel_wine_analysis_grape_variety_${i}`] || 
                        customFields[`varietal_${i}`];
        if (varietal) {
          const varietalNames = String(varietal).split(',').map(s => s.trim()).filter(Boolean);
          varietalNames.forEach(v => {
            if (!varietals.includes(v)) {
              varietals.push(v);
              console.log(`Added varietal ${i}: ${v}`);
            }
          });
        }
      }
    }
    
    // Produkt-URL
    let productUrl = null;
    
    // Versuche, die URL aus den SEO-URLs zu extrahieren
    if (product.seoUrls && product.seoUrls.length > 0) {
      const seoUrl = product.seoUrls[0];
      if (seoUrl.seoPathInfo || seoUrl.pathInfo) {
        const seoPath = seoUrl.seoPathInfo || seoUrl.pathInfo;
        productUrl = `https://www.vinaturel.de/${seoPath.replace(/^\//, '')}`;
        console.log(`Product URL from SEO: ${productUrl}`);
      }
    } 
    
    // Falls keine SEO-URL gefunden wurde, versuche es mit den Custom Fields
    if (!productUrl) {
      const seoPath = customFields.vinaturel_product_seo_url || customFields.product_url;
      if (seoPath) {
        productUrl = `https://www.vinaturel.de/${seoPath.replace(/^\//, '')}`;
        console.log(`Product URL from custom fields: ${productUrl}`);
      } else {
        // Fallback: Baue die URL mit der Produkt-ID
        productUrl = `https://www.vinaturel.de/detail/index/sArticle/${product.id}`;
        console.log(`Using fallback product URL: ${productUrl}`);
      }
    }
    
    // Bild-URL
    let imageUrl = null;
    
    // Versuche zuerst das Cover-Bild
    if (product.cover) {
      if (product.cover.url) {
        imageUrl = product.cover.url.startsWith('http') ? product.cover.url : `https:${product.cover.url}`;
        console.log(`Using cover image: ${imageUrl}`);
      } else if (product.cover.media && product.cover.media.url) {
        imageUrl = product.cover.media.url.startsWith('http') ? product.cover.media.url : `https:${product.cover.media.url}`;
        console.log(`Using cover media image: ${imageUrl}`);
      }
    }
    
    // Wenn kein Cover-Bild gefunden wurde, durchsuche die Medien
    if (!imageUrl && product.media && product.media.length > 0) {
      // Suche nach dem ersten gültigen Medien-Element
      const mediaItem = product.media.find(m => {
        if (m.media && m.media.url) {
          return true;
        } else if (m.url) {
          return true;
        }
        return false;
      });
      
      if (mediaItem) {
        if (mediaItem.media && mediaItem.media.url) {
          imageUrl = mediaItem.media.url.startsWith('http') ? mediaItem.media.url : `https:${mediaItem.media.url}`;
        } else if (mediaItem.url) {
          imageUrl = mediaItem.url.startsWith('http') ? mediaItem.url : `https:${mediaItem.url}`;
        }
        
        if (imageUrl) {
          console.log(`Using media item image: ${imageUrl}`);
        }
      }
    }
    
    // Wenn immer noch kein Bild gefunden wurde, überprüfe die Custom Fields
    if (!imageUrl) {
      imageUrl = customFields.vinaturel_product_image_url || customFields.image_url;
      if (imageUrl) {
        imageUrl = imageUrl.startsWith('http') ? imageUrl : `https:${imageUrl}`;
        console.log(`Using image from custom fields: ${imageUrl}`);
      }
    }
    
    return {
      externalId: product.id,
      articleNumber: product.productNumber || '',
      producer,
      name,
      country,
      region,
      vintage,
      volumeMl,
      varietals,
      productUrl,
      imageUrl,
    };
  } catch (error) {
    console.error(`❌ Error processing product ${product?.id || 'unknown'}:`, error);
    return null;
  }
}

async function upsertProduct(client, productData) {
  try {
    // Prüfe, ob das Produkt bereits existiert
    const existingProduct = await client.query(
      'SELECT id FROM vinaturel_wines WHERE external_id = $1',
      [productData.externalId]
    );

    const now = new Date();

    // Extrahiere die Rebsorten
    const varietal1 = productData.varietals && productData.varietals.length > 0 ? productData.varietals[0] : null;
    const varietal2 = productData.varietals && productData.varietals.length > 1 ? productData.varietals[1] : null;
    const varietal3 = productData.varietals && productData.varietals.length > 2 ? productData.varietals[2] : null;

    if (existingProduct.rows.length > 0) {
      // Update existing product
      await client.query(
        `UPDATE vinaturel_wines 
         SET 
           article_number = $1,
           producer = $2,
           name = $3,
           country = $4,
           region = $5,
           vintage = $6,
           volume_ml = $7,
           varietal_1 = $8,
           varietal_2 = $9,
           varietal_3 = $10,
           product_url = $11,
           image_url = $12,
           updated_at = $13
         WHERE external_id = $14`,
        [
          productData.articleNumber,
          productData.producer,
          productData.name,
          productData.country,
          productData.region,
          productData.vintage,
          productData.volume_ml,
          varietal1,
          varietal2,
          varietal3,
          productData.productUrl,
          productData.imageUrl,
          now,
          productData.externalId
        ]
      );
      console.log(`🔄 Updated product: ${productData.name} (${productData.externalId})`);
    } else {
      // Insert new product
      await client.query(
        `INSERT INTO vinaturel_wines 
         (external_id, article_number, producer, name, country, region, vintage, volume_ml, 
          varietal_1, varietal_2, varietal_3, product_url, image_url, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          productData.externalId,
          productData.articleNumber,
          productData.producer,
          productData.name,
          productData.country,
          productData.region,
          productData.vintage,
          productData.volume_ml,
          varietal1,
          varietal2,
          varietal3,
          productData.productUrl,
          productData.imageUrl,
          now,
          now
        ]
      );
      console.log(`✅ Imported product: ${productData.name} (${productData.externalId})`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Database error for product ${productData.externalId}:`, error.message);
    throw error;
  }
}

async function fetchAllProperties() {
  try {
    console.log('📋 Fetching all properties...');
    const response = await axios.get(`${API_BASE_URL}/property-group`, {
      headers: {
        'Content-Type': 'application/json',
        'sw-access-key': API_KEY,
        'Accept': 'application/json',
      },
      params: {
        'associations[options]': [],
        'limit': 1000, // Hohe Grenze, um alle Eigenschaften auf einmal zu laden
      },
      validateStatus: status => status >= 200 && status < 300,
      timeout: 10000,
    });
    
    console.log(`✅ Fetched ${response.data?.elements?.length || 0} property groups`);
    return response.data?.elements || [];
  } catch (error) {
    console.error('❌ Error fetching properties:', error.message);
    return [];
  }
}

async function fetchProducts(page = 1, limit = 1) {
  try {
    console.log(`📡 Fetching page ${page}...`);
    
    // Erstelle eine neue Axios-Instanz mit Standardkonfiguration
    const api = axios.create({
      baseURL: 'https://www.vinaturel.de/store-api',
      headers: {
        'sw-access-key': process.env.VINATUREL_API_KEY,
        'Content-Type': 'application/json',
      },
      // Deaktiviere die automatische Umwandlung von Antworten
      transformResponse: [function (data) {
        return data;
      }]
    });
    
    // Führe die einfache GET-Anfrage aus, ähnlich wie mit cURL
    console.log('📦 Fetching products using simple GET request...');
    const response = await api.get('/product', {
      params: {
        limit,
        page,
        'associations[manufacturer]': {},
        'associations[properties]': {},
        'associations[media]': {},
        'associations[seoUrls]': {},
        'associations[cover]': {},
        'includes': {
          'product': [
            'id',
            'name',
            'productNumber',
            'description',
            'stock',
            'price',
            'cover',
            'manufacturer',
            'properties',
            'media',
            'seoUrls',
            'translated',
            'availableStock',
            'calculatedPrice',
            'customFields'
          ]
        }
      }
    });
    
    // Debug-Ausgabe
    console.log('API Response Status:', response.status);
    
    // Versuche, die Antwort zu parsen
    let responseData;
    try {
      responseData = JSON.parse(response.data);
    } catch (e) {
      console.error('Failed to parse JSON response:', e);
      console.error('Raw response:', response.data);
      return [];
    }
    
    console.log('Parsed Response Keys:', Object.keys(responseData));
    
    // Extrahiere die Elemente aus der Antwort
    let elements = [];
    if (responseData.elements && Array.isArray(responseData.elements)) {
      elements = responseData.elements;
    } else if (responseData.data) {
      elements = Array.isArray(responseData.data) ? responseData.data : [responseData.data];
    }
    
    console.log(`Found ${elements.length} elements`);
    if (elements.length > 0) {
      console.log('First element keys:', Object.keys(elements[0]));
      
      // Debug: Zeige die ersten 3 Elemente an
      elements.slice(0, 3).forEach((element, index) => {
        console.log(`\n--- Element ${index + 1} ---`);
        console.log('Name:', element.translated?.name || element.name);
        console.log('ID:', element.id);
        console.log('Product Number:', element.productNumber);
        console.log('Properties:', element.properties ? element.properties.length : 0);
        
        if (element.properties && element.properties.length > 0) {
          console.log('First property:', {
            name: element.properties[0].name,
            translated: element.properties[0].translated,
            group: element.properties[0].group ? {
              name: element.properties[0].group.name,
              translated: element.properties[0].group.translated
            } : null
          });
        }
      });
      
      // Gebe die Elemente zurück, damit sie verarbeitet werden können
      return elements;
    }
  } catch (error) {
    console.error('Error fetching products:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      if (error.response.data) {
        console.error('Response data:', error.response.data.substring(0, 500) + '...');
      }
    }
    return [];
  }
}

async function processProductBatch(client, products, allProperties, page) {
  let totalImported = 0;
  let totalProcessed = 0;
  
  try {
    await client.query('BEGIN');
    
    for (const product of products) {
      try {
        const productData = await processProduct(product, allProperties);
        if (!productData) continue;
        
        console.log(`Processing product: ${productData.name}`);
        console.log('Product data:', JSON.stringify(productData, null, 2));
        
        const imported = await upsertProduct(client, productData);
        if (imported) totalImported++;
        totalProcessed++;
      } catch (error) {
        console.error(`❌ Error processing product ${product.id}:`, error.message);
        // Bei Fehlern in der Verarbeitung eines Produkts, mache mit dem nächsten weiter
        await client.query('ROLLBACK');
        await client.query('BEGIN');
      }
    }
    
    await client.query('COMMIT');
    console.log(`✅ Processed page ${page}. Imported/Updated ${totalImported} products`);
    return { totalImported, totalProcessed };
    
  } catch (batchError) {
    console.error('❌ Batch processing error:', batchError);
    await client.query('ROLLBACK');
    return { totalImported: 0, totalProcessed: 0 };
  }
}

async function resetDatabase(client) {
  try {
    await client.query('DROP TABLE IF EXISTS vinaturel_wines');
    console.log('✅ Database table reset');
    return true;
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    return false;
  }
}

async function main() {
  const client = await pool.connect();
  
  try {
    // Setze die Datenbank zurück
    await resetDatabase(client);
    
    // Stelle sicher, dass die Tabelle existiert
    await ensureTableExists(client);
    
    // Lade alle Eigenschaften
    console.log('📋 Fetching all properties...');
    const properties = []; // Wir verwenden die Properties nicht mehr, da wir sie direkt aus den Produkten extrahieren
    console.log(`✅ Using direct property extraction`);
    
    // Lade Produkte
    console.log('📄 Fetching products...');
    const products = await fetchProducts(1, 10); // Lade 10 Produkte zum Testen
    
    if (!products || products.length === 0) {
      console.log('ℹ️ No products found');
      return;
    }
    
    console.log(`\n🎉 Loaded ${products.length} products successfully!`);
    
    // Verarbeite alle geladenen Produkte
    let totalImported = 0;
    
    for (const product of products) {
      try {
        console.log(`\n🔍 Processing product: ${product.translated?.name || product.name || 'Unnamed Product'}`);
        const productData = await processProduct(product, properties);
        
        if (productData) {
          console.log('📊 Processed product data:', JSON.stringify({
            name: productData.name,
            producer: productData.producer,
            country: productData.country,
            region: productData.region,
            vintage: productData.vintage,
            varietals: productData.varietals,
            productUrl: productData.productUrl,
            imageUrl: productData.imageUrl
          }, null, 2));
          
          const result = await upsertProduct(client, productData);
          if (result) totalImported++;
          console.log(`💾 Product ${result ? 'imported' : 'updated'} successfully!`);
        } else {
          console.log('❌ Failed to process product');
        }
      } catch (error) {
        console.error(`❌ Error processing product: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Successfully processed ${totalImported} of ${products.length} products`);
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
