import { Router } from 'express';
import { VinaturelService } from '../../services/vinaturel.service';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

interface WineSearchResult {
  id: number;
  producer: string;
  name: string;
  vintage: number;
  varietals: string[];
  [key: string]: any;
}

interface WineSearchResult {
  externalId: string;
  producer: string;
  name: string;
  country: string;
  region: string;
  vintage: number;
  varietals: string[];
  articleNumber: string | null;
  productUrl: string | null;
  imageUrl: string | null;
  volumeMl: number | null;
  varietal1: string | null;
  varietal2: string | null;
  varietal3: string | null;
}

export const vinaturelRouter = Router();

// Import wines from Vinaturel API to our database
vinaturelRouter.post('/import', async (req, res) => {
  try {
    const result = await VinaturelService.importWines();
    res.json({ success: true, message: `Successfully imported ${result.count} wines` });
  } catch (error) {
    console.error('Error in /api/vinaturel/import:', error);
    res.status(500).json({ success: false, message: 'Failed to import wines' });
  }
});

// Search wines in our database
vinaturelRouter.get('/search', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);
  
  const log = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logData = data ? ` - ${JSON.stringify(data, null, 2)}` : '';
    console.log(`[${timestamp}] [${requestId}] ${message}${logData}`);
  };
  
  const logError = (message: string, error: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${requestId}] ${message}`, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
  };
  
  try {
    log('Received search request', { query: req.query });
    
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      log('Invalid or missing query parameter', { query: q });
      return res.status(400).json({ 
        success: false, 
        message: 'Query parameter q is required and must be a string',
        requestId
      });
    }
    
    const trimmedQuery = q.trim();
    if (trimmedQuery.length < 2) {
      log('Query too short', { query: trimmedQuery });
      return res.status(400).json({ 
        success: false, 
        message: 'Query must be at least 2 characters long',
        requestId
      });
    }
    
    log(`Searching for wines with query: "${trimmedQuery}"`);
    
    log(`Searching with query: "${trimmedQuery}"`);
    
    // 1. Zuerst prüfen, ob die Tabelle existiert und Daten enthält
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vinaturel_wines'
      ) as table_exists;
    `);
    
    if (!tableCheck.rows[0]?.table_exists) {
      log('Tabelle vinaturel_wines existiert nicht');
      return res.status(200).json({ data: [] });
    }
    
    // 2. Anzahl der Einträge in der Tabelle prüfen
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM vinaturel_wines;`);
    log(`Anzahl der Weine in der Datenbank: ${countResult.rows[0]?.count || 0}`);
    
    // 3. Einfache Suche mit expliziter Typisierung
    const searchTerm = `%${trimmedQuery}%`;
    log(`Suche nach: ${searchTerm}`);
    
    const searchResults = await db.execute(sql`
      SELECT 
        id,
        external_id as "externalId",
        producer,
        name,
        vintage,
        country,
        region,
        varietal_1 as "varietal1",
        varietal_2 as "varietal2",
        varietal_3 as "varietal3",
        product_url as "productUrl",
        image_url as "imageUrl"
      FROM vinaturel_wines
      WHERE 
        LOWER(producer) LIKE LOWER(${searchTerm}) OR
        LOWER(name) LIKE LOWER(${searchTerm})
      LIMIT 50
    `);
    
    log(`Gefundene Ergebnisse: ${searchResults.rows.length}`);
    
    const wines = searchResults.rows.map((w: any) => ({
      id: w.id,
      externalId: w.externalId || '',
      producer: w.producer || '',
      name: w.name || '',
      vintage: w.vintage || 0,
      country: w.country || '',
      region: w.region || '',
      varietals: [
        w.varietal1,
        w.varietal2,
        w.varietal3
      ].filter(Boolean),
      productUrl: w.productUrl || null,
      imageUrl: w.imageUrl || null
    }));
  
    log(`Search completed, found ${wines.length} wines`);
    
    // Debug: Protokolliere die ersten 3 gefundenen Weine
    if (wines.length > 0) {
      log('Sample results', wines.slice(0, 3).map((w: any) => ({
        id: w.id,
        producer: w.producer,
        name: w.name,
        vintage: w.vintage,
        varietals: w.varietals
      })));
    } else {
      log('No wines found for query', { query: trimmedQuery });
      // Debug: Zeige alle verfügbaren Produzenten an
      const allWines = await db.execute(sql`SELECT DISTINCT producer FROM vinaturel_wines;`);
      log('Available producers:', allWines.rows);
    }
    
    // Berechne die Antwortzeit
    const responseTime = Date.now() - startTime;
    
    // Sende die Antwort
    res.json({ 
      success: true, 
      data: wines,
      meta: {
        query: trimmedQuery,
        count: wines.length,
        responseTime: `${responseTime}ms`,
        requestId
      }
    });
  } catch (error) {
    logError('Error during search', error);
    res.status(500).json({
      success: false,
      message: 'Ein Fehler ist bei der Suche aufgetreten',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      requestId
    });
  }
});

export default vinaturelRouter;
