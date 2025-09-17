import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import { storage } from "./storage";
import { setupAuth } from "./auth";

// Map zum Speichern der aktiven WebSocket-Verbindungen pro Tasting
const joinRooms = new Map<number, Set<WebSocket>>();
import { flights, users, wines } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import axios from "axios";
import { VinaturelAPI } from "./vinaturel-api";
import { VinaturelService } from "./services/vinaturel.service";
import {
  insertTastingSchema,
  insertScoringRuleSchema,
  insertFlightSchema,
  insertWineSchema,
  insertGuessSchema,
  insertParticipantSchema,
  type ScoringRule,
  type Guess,
  type Wine,
  type Participant
} from "@shared/schema";
import { Pool } from 'pg';

// Helper function to ensure user is authenticated
async function ensureAuthenticated(req: Request, res: Response, next: Function) {
  console.log("=== AUTHENTICATION CHECK ===");
  console.log("Path:", req.path);
  console.log("Session ID:", req.sessionID);
  console.log("Session data:", req.session);
  console.log("User:", req.user);
  
  // Check if user is authenticated via Passport
  if (req.isAuthenticated() && req.user) {
    console.log("User is authenticated via Passport, user ID:", req.user.id);
    // Ensure session has the user ID
    if (!req.session) {
      req.session = {} as any;
    }
    req.session.userId = req.user.id;
    return next();
  }
  
  // Check session userId
  if (req.session?.userId) {
    console.log("User is authenticated via session, user ID:", req.session.userId);
    try {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (error) {
      console.error("Error loading user from session:", error);
    }
  }
  
  // In development mode, allow access with debug info
  if (process.env.NODE_ENV === 'development') {
    console.warn("DEV MODE: Allowing access without authentication");
    console.log("Auth check debug:", { 
      sessionID: req.sessionID,
      session: req.session,
      cookies: req.headers.cookie,
      headers: req.headers
    });
    
    // For development, create a test user if none exists
    if (!req.user) {
      try {
        const testUser = await storage.getUserByEmail('test@example.com') || 
          await storage.createUser({
            email: 'test@example.com',
            name: 'Test User',
            company: 'Test Company',
            password: 'password123',
            profileImage: ''
          });
        req.user = testUser;
        req.session.userId = testUser.id;
        console.log("Using test user:", testUser);
      } catch (error) {
        console.error("Error creating test user:", error);
      }
    }
    
    return next();
  }
  
  console.error("Authentication failed: No valid session found");
  return res.status(401).json({ 
    error: "Kein User eingeloggt"
  });
}

const normalizeText = (value?: string | null) => (value ?? '').toString().trim().toLowerCase();
const equalText = (a?: string | null, b?: string | null) => normalizeText(a) === normalizeText(b);
const equalVintage = (a?: string | null, b?: string | null) => {
  const aa = (a ?? '').toString().trim();
  const bb = (b ?? '').toString().trim();
  return aa === bb || Number(aa) === Number(bb);
};

const calculateGuessScore = (guess: Guess, wine: Wine, rules: ScoringRule): number => {
  if (!rules) return guess.score ?? 0;

  let score = 0;
  if (rules.country > 0 && guess.country && equalText(guess.country, wine.country)) {
    score += rules.country;
  }
  if (rules.region > 0 && guess.region && equalText(guess.region, wine.region)) {
    score += rules.region;
  }
  if (rules.producer > 0 && guess.producer && equalText(guess.producer, wine.producer)) {
    score += rules.producer;
  }
  if (rules.wineName > 0 && guess.name && equalText(guess.name, wine.name)) {
    score += rules.wineName;
  }
  if (rules.vintage > 0 && guess.vintage && equalVintage(guess.vintage, wine.vintage)) {
    score += rules.vintage;
  }

  if (rules.varietals && rules.varietals > 0) {
    const guessVarietals = Array.isArray(guess.varietals)
      ? guess.varietals.map((v) => v?.toLowerCase?.() ?? '').filter(Boolean)
      : [];
    const wineVarietals = Array.isArray(wine.varietals)
      ? wine.varietals.map((v) => v?.toLowerCase?.() ?? '').filter(Boolean)
      : [];

    if (guessVarietals.length && wineVarietals.length) {
      if (rules.anyVarietalPoint) {
        const matched = guessVarietals.filter((v) => wineVarietals.includes(v)).length;
        score += matched * rules.varietals;
      } else {
        const sortedGuess = [...guessVarietals].sort();
        const sortedWine = [...wineVarietals].sort();
        const allMatch =
          sortedGuess.length === sortedWine.length &&
          sortedGuess.every((v, index) => v === sortedWine[index]);
        if (allMatch) {
          score += rules.varietals;
        }
      }
    }
  }

  if (typeof guess.overrideScore === 'number') {
    score += guess.overrideScore;
  }

  return score;
};

const recalculateScoresForTasting = async (tastingId: number, rules: ScoringRule) => {
  const participants = await storage.getParticipantsByTasting(tastingId);
  const flightsForTasting = await storage.getFlightsByTasting(tastingId);

  const winesById: Record<number, Wine> = {};
  for (const flight of flightsForTasting) {
    const winesInFlight = await storage.getWinesByFlight(flight.id);
    for (const wine of winesInFlight) {
      winesById[wine.id] = wine;
    }
  }

  const wineList = Object.values(winesById);

  for (const participant of participants as Participant[]) {
    let total = 0;

    for (const wine of wineList) {
      const guess = await storage.getGuessByWine(participant.id, wine.id);
      if (!guess) continue;

      const guessScore = calculateGuessScore(guess as Guess, wine as Wine, rules);
      await storage.updateGuessScore(guess.id, guessScore);
      total += guessScore;
    }

    await storage.updateParticipantScore(participant.id, total);
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // In-memory WebSocket rooms for join page
  const joinRooms = new Map<number, Set<any>>();
  // Simple in-memory cache for host user info during process lifetime
  const hostUserCache = new Map<number, { name: string; company: string | null }>();
  // Setup authentication routes
  setupAuth(app);

  // Quick health check
  app.get('/api/ping', (_req, res) => res.json({ ok: true, pong: true }));

  // Vinaturel API integration for wine data
  app.get("/api/vinaturel/wines", process.env.NODE_ENV === 'development' ? (req, res, next) => next() : ensureAuthenticated, async (req, res) => {
    try {
      // Verwende die Umgebungsvariablen für die API-Zugangsdaten
      const credentials = {
        username: process.env.VINATUREL_USERNAME || '',
        password: process.env.VINATUREL_PASSWORD || '',
        apiKey: process.env.VINATUREL_API_KEY || ''
      };

      console.log('Vinaturel API credentials used:', {
        username: credentials.username ? credentials.username : 'not set',
        password: credentials.password ? 'is set' : 'not set',
        apiKey: credentials.apiKey ? `${credentials.apiKey.substring(0, 5)}...` : 'not set',
      });

      // Überprüfe, ob die erforderlichen Anmeldeinformationen vorhanden sind
      if (!credentials.username || !credentials.password || !credentials.apiKey) {
        return res.status(500).json({
          error: 'Vinaturel API credentials not set',
          missingCredentials: {
            username: !credentials.username,
            password: !credentials.password,
            apiKey: !credentials.apiKey
          }
        });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;

      const wines = await VinaturelAPI.fetchWines(credentials, undefined, limit, page);
      res.json(wines);
    } catch (error) {
      console.error('Error fetching Vinaturel wines:', error);
      res.status(500).json({ error: 'Failed to fetch wines from Vinaturel' });
    }
  });

  // Import wines from Vinaturel API to our database
  app.post("/api/vinaturel/import", ensureAuthenticated, async (req, res) => {
    try {
      const result = await VinaturelService.importWines();
      res.json({ success: true, message: `Successfully imported ${result.count} wines` });
    } catch (error) {
      console.error('Error in /api/vinaturel/import:', error);
      res.status(500).json({ success: false, message: 'Failed to import wines' });
    }
  });

  // Search wines in our database
  app.get("/api/vinaturel/search", ensureAuthenticated, async (req, res) => {
    try {
      console.log('[/api/vinaturel/search] Received search request:', req.query);
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        console.error('[/api/vinaturel/search] Invalid query parameter:', q);
        return res.status(400).json({ success: false, message: 'Query parameter q is required' });
      }

      console.log('[/api/vinaturel/search] Searching for:', q);
      const wines = await VinaturelService.searchWines(q);
      console.log('[/api/vinaturel/search] Found wines:', wines.data.length);
      res.json({ success: true, data: wines });
    } catch (error) {
      console.error('[/api/vinaturel/search] Error:', error);
      if (error instanceof Error) {
        console.error('[/api/vinaturel/search] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      res.status(500).json({ 
        success: false, 
        message: 'Failed to search wines',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('Registering /api/wines/search route'); // Debug
  app.get('/api/wines/search', async (req, res) => {
    console.log('Handling search via DB', { query: req.query.q }); // Debug
    // ... bestehender Code
  });

  app.get('/api/wines/search', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Suchparameter fehlt' });
      }
      
      const results = await storage.searchWines(q);
      res.json(results);
      
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Suche fehlgeschlagen' });
    }
  });

  // Get user's tastings (hosted, participating, invited, available)
  app.get("/api/tastings", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Nicht autorisiert" });

      const userEmail = req.user?.email;
      const result = await storage.getUserTastings(userId, userEmail || "");

      // Post-process: ensure hostName/hostCompany present
      const hydrateHost = async (arr: any[]) => {
        const out: any[] = [];
        for (const t of arr || []) {
          if (!t.hostName || String(t.hostName).trim().length === 0) {
            try {
              const u = await storage.getUser(t.hostId);
              if (u) {
                t.hostName = (u.name || '').trim();
                t.hostCompany = u.company || null;
              }
            } catch {}
          }
          out.push(t);
        }
        return out;
      };

      const hosted = await hydrateHost(result.hosted);
      const participating = await hydrateHost(result.participating);
      const available = await hydrateHost(result.available);
      const invited = await hydrateHost(result.invited);

      return res.json({ hosted, participating, available, invited, isAuthenticated: true });
    } catch (error) {
      console.error("Fehler in /api/tastings:", error);
      return res.status(500).json({ 
        error: "Ein Fehler ist aufgetreten",
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Create a new tasting
  app.post("/api/tastings", ensureAuthenticated, async (req, res) => {
    console.log('Session User:', req.user?.id);
    console.log('Session ID:', req.sessionID);
    console.log('Session Store:', storage.sessionStore);
    try {
      // HostId IMMER aus der Session/User ermitteln, NIE vom Client übernehmen!
      let userId: number | undefined = undefined;
      if (req.user && req.user.id) {
        userId = req.user.id;
      } else if (req.session && req.session.userId) {
        userId = req.session.userId;
      }
      if (!userId) {
        return res.status(401).json({ error: "Kein User eingeloggt" });
      }
      console.log("Verk. wird erstellt von User:", userId);
      // Validate tasting data
      const parsed = insertTastingSchema.parse({
        ...req.body,
        hostId: userId,
        isPublic: req.body.isPublic !== undefined ? Boolean(req.body.isPublic) : false
      });

      const createPayload: {
        name: string;
        hostId: number;
        isPublic: boolean;
        password?: string;
        invitedEmails?: string[];
      } = {
        name: parsed.name,
        hostId: userId,
        isPublic: Boolean(parsed.isPublic),
        password: parsed.password ?? undefined,
        invitedEmails: (parsed as any).invitedEmails ?? undefined,
      };

      const tasting = await storage.createTasting(createPayload);
      // If it's private, add invitees
      if (!tasting.isPublic && req.body.invitees) {
        const invitees: string[] = req.body.invitees;
        for (const email of invitees) {
          await storage.addTastingInvitee({ 
            email,
            tastingId: tasting.id,
            role: 'guest'
          });
        }
      }
      res.status(201).json(tasting);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Development helper: list tasting invites
  if (process.env.NODE_ENV === 'development') {
    app.get('/api/debug/invites', async (_req, res) => {
      try {
        const rows = await storage.getTastingInvitees(0).catch(() => [] as any);
        // get all invites if tastingId=0 shortcut unsupported
        // Fallback direct query when method expects id
        if (Array.isArray(rows) && rows.length > 0) {
          return res.json(rows);
        }
        // Try reading raw table via db if available
        try {
          const { tastingInvites } = await import('../db/schema');
          const { db } = await import('./db');
          const all = await db.select().from(tastingInvites);
          return res.json(all);
        } catch (e) {
          return res.json({ error: 'Unable to fetch invites', details: String(e) });
        }
      } catch (e) {
        return res.status(500).json({ error: String(e) });
      }
    });
  }

  // Get a specific tasting
  app.get("/api/tastings/:id", async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      // Ensure status is always set, and auto-complete when all flights are completed
      try {
        const totalRes = await db.execute(sql`SELECT COUNT(*)::int AS total FROM flights WHERE tasting_id = ${tastingId}`);
        const total = (totalRes.rows?.[0] as any)?.total ?? 0;
        if (total > 0) {
          const openRes = await db.execute(sql`
            SELECT COUNT(*)::int AS open
            FROM flights
            WHERE tasting_id = ${tastingId}
              AND completed_at IS NULL
          `);
          const open = (openRes.rows?.[0] as any)?.open ?? 0;
          const allCompleted = open === 0;
          if (allCompleted && tasting.status !== 'completed') {
            try {
              const updated = await storage.updateTastingStatus(tastingId, 'completed');
              tasting.status = updated.status;
            } catch {}
          }
        }
        if (!tasting.status) {
          tasting.status = 'draft';
        }
      } catch {
        if (!tasting.status) tasting.status = 'draft';
      }
      // Hydrate host name/company with lightweight cache
      try {
        const cached = hostUserCache.get(tasting.hostId);
        if (cached) {
          (tasting as any).hostName = cached.name;
          (tasting as any).hostCompany = cached.company ?? null;
        } else {
          const hostUser = await storage.getUser(tasting.hostId);
          if (hostUser) {
            hostUserCache.set(tasting.hostId, { name: hostUser.name || '', company: hostUser.company || null });
            (tasting as any).hostName = hostUser.name || '';
            (tasting as any).hostCompany = hostUser.company || null;
          }
        }
      } catch {}

      res.json(tasting);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // List invites for a tasting (debug/host use)
  app.get("/api/tastings/:id/invites", async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const invites = await storage.getTastingInvitees(tastingId);
      return res.json(invites);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  });

  // Add an invite (host only)
  app.post("/api/tastings/:id/invites", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const email = (req.body?.email || '').toString().trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Ungültige E-Mail' });
      }
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });
      if (req.user && tasting.hostId !== req.user.id) {
        return res.status(403).json({ error: 'Nur der Host darf Einladungen verwalten' });
      }
      const invite = await storage.addTastingInvitee({ tastingId, email, role: 'guest' });
      return res.status(201).json(invite);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  });

  // Remove an invite (host only)
  app.delete("/api/tastings/:id/invites/:email", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });
      if (req.user && tasting.hostId !== req.user.id) {
        return res.status(403).json({ error: 'Nur der Host darf Einladungen verwalten' });
      }
      const ok = await storage.removeTastingInvitee(tastingId, email);
      return res.status(ok ? 200 : 404).json({ ok });
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  });

  // Update tasting status
  app.patch("/api/tastings/:id/status", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || !["draft", "active", "started"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const tasting = await storage.getTasting(tastingId);
      
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // Only the host can update the status
      if (req.user && tasting.hostId !== req.user.id) {
        return res.status(403).json({ error: "Only the host can update the tasting status" });
      }
      
      // When setting to active, check if at least one flight with wines exists
      if (status === "active") {
        const flights = await storage.getFlightsByTasting(tastingId);
        
        if (!flights || flights.length === 0) {
          return res.status(400).json({ error: "Cannot activate tasting without flights" });
        }
      }
      
      const updatedTasting = await storage.updateTasting(tastingId, { status });

      // Broadcast status change to waiting room
      if (joinRooms.has(tastingId)) {
        const payload = JSON.stringify({
          type: 'tasting_status',
          status,
          tastingId,
          timestamp: new Date().toISOString(),
        });
        for (const client of joinRooms.get(tastingId) || []) {
          if (client.readyState === 1) {
            try { client.send(payload); } catch {}
          }
        }
      }

      res.json(updatedTasting);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Create scoring rules for a tasting
  app.post("/api/tastings/:id/scoring", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // Only the host can set scoring rules
      if (tasting.hostId !== req.user!.id) {
        return res.status(403).json({ error: "Only the host can set scoring rules" });
      }
      
      if (tasting.status && !['draft', 'active'].includes(tasting.status)) {
        return res.status(400).json({ error: "Scoring rules can only be changed before the tasting starts" });
      }

      // Validate scoring rule data
      const scoringRuleData = insertScoringRuleSchema.parse({
        ...req.body,
        tastingId
      });

      // Check if scoring rules already exist
      const existingRules = await storage.getScoringRule(tastingId);
      if (existingRules) {
        const { tastingId: _tid, ...updateFields } = scoringRuleData as any;
        const updated = await storage.updateScoringRule(tastingId, updateFields);
        await recalculateScoresForTasting(tastingId, updated);
        return res.status(200).json(updated);
      }

      const scoringRule = await storage.createScoringRule(scoringRuleData);
      await recalculateScoresForTasting(tastingId, scoringRule);
      res.status(201).json(scoringRule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  // Update scoring rules for a tasting (before start)
  app.patch("/api/tastings/:id/scoring", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);

      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }

      if (tasting.hostId !== req.user!.id) {
        return res.status(403).json({ error: "Only the host can update scoring rules" });
      }

      if (tasting.status && tasting.status !== 'draft') {
        return res.status(400).json({ error: "Scoring rules can only be changed before the tasting starts" });
      }

      const existing = await storage.getScoringRule(tastingId);
      if (!existing) {
        return res.status(404).json({ error: "Scoring rules not found" });
      }

      const updateSchema = insertScoringRuleSchema.partial().omit({ tastingId: true });
      const updateData = updateSchema.parse(req.body);

      const updated = await storage.updateScoringRule(tastingId, updateData);
      await recalculateScoresForTasting(tastingId, updated);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  // Get scoring rules for a tasting
  app.get("/api/tastings/:id/scoring", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      const scoringRule = await storage.getScoringRule(tastingId);
      if (!scoringRule) {
        return res.status(404).json({ error: "Scoring rules not found" });
      }
      
      res.json(scoringRule);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Create a flight for a tasting
  app.post("/api/tastings/:tastingId/flights", ensureAuthenticated, async (req, res) => {
    console.log('Request body:', req.body);
    const tastingId = parseInt(req.params.tastingId);
    console.log('Creating flight for tasting:', tastingId);
    try {
      // Prevent creating flights if all existing flights are completed (robust DB check)
      const totalRes = await db.execute(sql`SELECT COUNT(*)::int AS total FROM flights WHERE tasting_id = ${tastingId}`);
      const total = (totalRes.rows?.[0] as any)?.total ?? 0;
      if (total > 0) {
        const openRes = await db.execute(sql`
          SELECT COUNT(*)::int AS open
          FROM flights
          WHERE tasting_id = ${tastingId}
            AND completed_at IS NULL
        `);
        const open = (openRes.rows?.[0] as any)?.open ?? 0;
        if (open === 0) {
          return res.status(400).json({ error: 'Alle Flights wurden bereits abgeschlossen. Es können keine weiteren Flights hinzugefügt werden.' });
        }
      }

      const existingFlights = await storage.getFlightsByTasting(tastingId);
      const flightData = {
        tastingId,
        name: `Flight ${existingFlights.length + 1}`,
        orderIndex: existingFlights.length,
        timeLimit: 1800
      };
      console.log('Flight data to create:', flightData);
      const flight = await storage.createFlight(flightData);
      res.status(201).json(flight);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Flight creation error:', errorMessage);
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get flights for a tasting
  app.get("/api/tastings/:tastingId/flights", ensureAuthenticated, async (req, res) => {
    const tastingId = parseInt(req.params.tastingId);
    console.log('Fetching flights for tasting:', tastingId);
    try {
      const flights = await storage.getFlightsByTasting(tastingId);

      // For each flight, fetch its wines and attach as .wines
      const flightsWithWines = await Promise.all(
        flights.map(async (flight) => {
          const wines = await storage.getWinesByFlight(flight.id);
          return { ...flight, wines };
        })
      );

      console.log('Flights result:', flightsWithWines);
      res.json(flightsWithWines);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Start a flight
  app.post("/api/flights/:id/start", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      
      // Get the flight
      const flights = Array.from(await storage.getAllTastings())
        .flatMap(async (tasting) => {
          return await storage.getFlightsByTasting(tasting.id);
        });
      
      const flight = (await Promise.all(flights)).flat().find(f => f.id === flightId);
      
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      
      // Get the tasting
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // Im Entwicklungsmodus Zugriff erlauben
      // This is for development only
      
      // Update flight start time
      const updatedFlight = await storage.updateFlightTimes(flightId, new Date(), undefined);

      // Broadcast flight started to waiting/join clients
      if (joinRooms.has(tasting.id)) {
        // Include minimal wine info
        const wines = await storage.getWinesByFlight(flightId);
        const payload = JSON.stringify({
          type: 'flight_started',
          tastingId: tasting.id,
          flightId: flightId,
          wines: wines?.map(w => ({ id: w.id, letterCode: w.letterCode })) || [],
          timestamp: new Date().toISOString(),
        });
        for (const client of joinRooms.get(tasting.id) || []) {
          if (client.readyState === 1) {
            try { client.send(payload); } catch {}
          }
        }
      }

      res.json(updatedFlight);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Set a timer for an active flight
  app.post("/api/flights/:id/timer", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      const { minutes } = req.body;
      
      if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
        return res.status(400).json({ error: "Valid timer minutes required (greater than 0)" });
      }
      
      // Get the flight
      const flights = Array.from(await storage.getAllTastings())
        .flatMap(async (tasting) => {
          return await storage.getFlightsByTasting(tasting.id);
        });
      
      const flight = (await Promise.all(flights)).flat().find(f => f.id === flightId);
      
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      
      // Check if flight is active (started but not completed)
      if (!flight.startedAt) {
        return res.status(400).json({ error: "Flight must be started before setting a timer" });
      }
      
      if (flight.completedAt) {
        return res.status(400).json({ error: "Cannot set timer for completed flight" });
      }
      
      // Get the tasting
      const tasting = await storage.getTasting(flight.tastingId);

      const timeLimit = (minutes * 60) || 0; // seconds

      // Broadcast timer started to clients
      if (joinRooms.has(tasting!.id)) {
        const payload = JSON.stringify({
          type: 'timer_started',
          tastingId: tasting!.id,
          flightId: flightId,
          timeLimit,
          startedAt: new Date().toISOString(),
        });
        for (const client of joinRooms.get(tasting!.id) || []) {
          if (client.readyState === 1) {
            try { client.send(payload); } catch {}
          }
        }
      }

      // Set timer to automatically complete the flight
      setTimeout(async () => {
        try {
          // Prüfe, ob der Flight noch aktiv ist
          const flightResult = await db.execute(
            sql`SELECT id, started_at as "startedAt", completed_at as "completedAt" FROM flights WHERE id = ${flightId} LIMIT 1`
          );
          
          const currentFlight = flightResult.rows[0] as { id: number; startedAt: Date | null; completedAt: Date | null } | undefined;
          
          if (currentFlight && currentFlight.startedAt && !currentFlight.completedAt) {
            // Flight ist noch aktiv, also beenden
            console.log(`Timer abgelaufen für Flight ${flightId}, beende automatisch`);
            const updated = await storage.updateFlightTimes(flightId, currentFlight.startedAt, new Date());

            // Punkte berechnen wie im manuellen Abschluss
            try {
              const winesInFlight = await storage.getWinesByFlight(flightId);
              const participantsInTasting = await storage.getParticipantsByTasting(tasting!.id);
              let rules = await storage.getScoringRule(tasting!.id);
              if (!rules) {
                // Fallback: lege Standard‑Regeln an, damit Punkte berechnet werden können
                rules = await storage.createScoringRule({
                  tastingId: tasting!.id,
                  country: 1,
                  region: 1,
                  producer: 1,
                  wineName: 1,
                  vintage: 1,
                  varietals: 1,
                  anyVarietalPoint: true,
                  displayCount: 5,
                });
              }
              if (rules) {
                for (const participant of participantsInTasting) {
                  let addScore = 0;
                  for (const wine of winesInFlight) {
                    const guess = await storage.getGuessByWine(participant.id, wine.id);
                    if (!guess) continue;
                    let s = 0;
                    const eqTxt = (a?: string | null, b?: string | null) =>
                      (a ?? '').toString().trim().toLowerCase() === (b ?? '').toString().trim().toLowerCase();
                    const eqVintage = (a?: string | null, b?: string | null) => {
                      const aa = (a ?? '').toString().trim();
                      const bb = (b ?? '').toString().trim();
                      return aa === bb || Number(aa) === Number(bb);
                    };
                    if (guess.country && eqTxt(wine.country, guess.country)) s += rules.country;
                    if (guess.region && eqTxt(wine.region, guess.region)) s += rules.region;
                    if (guess.producer && eqTxt(wine.producer, guess.producer)) s += rules.producer;
                    if (guess.name && eqTxt(wine.name, guess.name)) s += rules.wineName;
                    if (guess.vintage && eqVintage(wine.vintage, guess.vintage)) s += rules.vintage;
                    if (guess.varietals && guess.varietals.length > 0 && rules.varietals > 0) {
                      const gw = guess.varietals.map(v => v.toLowerCase());
                      const ww = wine.varietals.map(v => v.toLowerCase());
                      if (rules.anyVarietalPoint) {
                        const matched = gw.filter(v => ww.includes(v)).length;
                        s += matched * rules.varietals;
                      } else {
                        const gws = gw.slice().sort();
                        const wws = ww.slice().sort();
                        if (gws.length === wws.length && gws.every((v, i) => v === wws[i])) s += rules.varietals;
                      }
                    }
                    await storage.updateGuessScore(guess.id, s);
                    addScore += s;
                  }
                  const current = participant.score || 0;
                  await storage.updateParticipantScore(participant.id, current + addScore);
                }
                // Scores updated broadcast
                if (joinRooms.has(tasting!.id)) {
                  const payloadScores = JSON.stringify({ type: 'scores_updated', tastingId: tasting!.id, flightId });
                  for (const client of joinRooms.get(tasting!.id) || []) {
                    if (client.readyState === 1) { try { client.send(payloadScores); } catch {} }
                  }
                }
              }
            } catch (calcError) {
              console.error('Fehler bei Punkteberechnung (Auto-Complete):', calcError);
            }

            // Prüfen, ob alle Flights abgeschlossen sind
            let allCompleted = false;
            try {
              const totalRes = await db.execute(sql`SELECT COUNT(*)::int AS total FROM flights WHERE tasting_id = ${tasting!.id}`);
              const total = (totalRes.rows?.[0] as any)?.total ?? 0;
              if (total > 0) {
                const openRes = await db.execute(sql`
                  SELECT COUNT(*)::int AS open
                  FROM flights
                  WHERE tasting_id = ${tasting!.id}
                    AND completed_at IS NULL
                `);
                const open = (openRes.rows?.[0] as any)?.open ?? 0;
                allCompleted = open === 0;
              }
            } catch {}

            // Wenn alle Flights abgeschlossen sind → Tasting-Status auf 'completed'
            if (allCompleted) {
              try { await storage.updateTastingStatus(tasting!.id, 'completed'); } catch {}
            }
            // Broadcast completion so clients can redirect immediately
            if (joinRooms.has(tasting!.id)) {
              const payload = JSON.stringify({
                type: 'flight_completed',
                tastingId: tasting!.id,
                flightId: flightId,
                completedAt: new Date().toISOString(),
                allCompleted,
              });
              for (const client of joinRooms.get(tasting!.id) || []) {
                if (client.readyState === 1) {
                  try { client.send(payload); } catch {}
                }
              }
              if (allCompleted) {
                const payloadStatus = JSON.stringify({ type: 'tasting_status', status: 'completed', tastingId: tasting!.id, timestamp: new Date().toISOString() });
                for (const client of joinRooms.get(tasting!.id) || []) {
                  if (client.readyState === 1) { try { client.send(payloadStatus); } catch {} }
                }
              }
            }
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error('Fehler beim automatischen Beenden des Flights:', error.message);
          } else {
            console.error('Unbekannter Fehler beim automatischen Beenden des Flights');
          }
        }
      }, timeLimit * 1000);
      
      // Antwort sofort senden, damit der Host-Dialog nicht hängen bleibt
      return res.json({ ok: true, timeLimit });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error('Fehler beim Setzen des Flight-Timers:', errorMsg);
      res.status(500).json({ error: 'Interner Serverfehler beim Setzen des Timers' });
    }
  });

  // Complete a flight
  app.post("/api/flights/:id/complete", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      
      // Get the flight directly from the database
      const flightsResult = await db.select()
        .from(flights)
        .where(eq(flights.id, flightId))
        .limit(1);
      const flight = flightsResult[0];
      
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      
      // Get the tasting
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // Im Entwicklungsmodus Zugriff erlauben
      // This is for development only
      
      // Update flight completion time
      const updatedFlight = await storage.updateFlightTimes(flightId, flight.startedAt || new Date(), new Date());
      
      // Calculate scores for all guesses in this flight
      const wines = await storage.getWinesByFlight(flightId);
      const participants = await storage.getParticipantsByTasting(tasting.id);
      let scoringRules = await storage.getScoringRule(tasting.id);
      if (!scoringRules) {
        // Fallback: lege Standard‑Regeln an
        scoringRules = await storage.createScoringRule({
          tastingId: tasting.id,
          country: 1,
          region: 1,
          producer: 1,
          wineName: 1,
          vintage: 1,
          varietals: 1,
          anyVarietalPoint: true,
          displayCount: 5,
        });
      }
      
      if (scoringRules) {
        for (const participant of participants) {
          let totalScore = 0;
          
          for (const wine of wines) {
            const guess = await storage.getGuessByWine(participant.id, wine.id);
            
            if (guess) {
              let guessScore = 0;
              
              // Calculate score based on scoring rules
              if (guess.country && wine.country === guess.country) {
                guessScore += scoringRules.country;
              }
              
              if (guess.region && wine.region === guess.region) {
                guessScore += scoringRules.region;
              }
              
              if (guess.producer && wine.producer === guess.producer) {
                guessScore += scoringRules.producer;
              }
              
              if (guess.name && wine.name === guess.name) {
                guessScore += scoringRules.wineName;
              }
              
              if (guess.vintage && wine.vintage === guess.vintage) {
                guessScore += scoringRules.vintage;
              }
              
              // Varietals scoring
              if (guess.varietals && guess.varietals.length > 0 && scoringRules.varietals > 0) {
                const gw = guess.varietals.map(v => v.toLowerCase());
                const ww = wine.varietals.map(v => v.toLowerCase());
                if (scoringRules.anyVarietalPoint) {
                  // Punkte pro korrekte Rebsorte
                  const matched = gw.filter(v => ww.includes(v)).length;
                  guessScore += matched * scoringRules.varietals;
                } else {
                  // Punkte nur wenn alle Rebsorten korrekt
                  if (
                    gw.length === ww.length &&
                    gw.slice().sort().every((v, i) => v === ww.slice().sort()[i])
                  ) {
                    guessScore += scoringRules.varietals;
                  }
                }
              }
              
              // Update guess score
              await storage.updateGuessScore(guess.id, guessScore);
              totalScore += guessScore;
            }
          }
          
          // Update participant's total score
          const currentScore = participant.score || 0;
          await storage.updateParticipantScore(participant.id, currentScore + totalScore);
        }
      }
      
      // Prüfen, ob alle Flights abgeschlossen sind und an Clients signalisieren
      try {
        const totalRes = await db.execute(sql`SELECT COUNT(*)::int AS total FROM flights WHERE tasting_id = ${tasting.id}`);
        const total = (totalRes.rows?.[0] as any)?.total ?? 0;
        let allCompleted = false;
        if (total > 0) {
          const openRes = await db.execute(sql`
            SELECT COUNT(*)::int AS open
            FROM flights
            WHERE tasting_id = ${tasting.id}
              AND completed_at IS NULL
          `);
          const open = (openRes.rows?.[0] as any)?.open ?? 0;
          allCompleted = open === 0;
        }
        // Wenn jetzt alle Flights abgeschlossen sind → Tasting-Status auf 'completed'
        if (allCompleted) {
          try { await storage.updateTastingStatus(tasting.id, 'completed'); } catch (e) { console.warn('Update tasting to completed failed', e); }
        }
        if (joinRooms.has(tasting.id)) {
          const payload = JSON.stringify({
            type: 'flight_completed',
            tastingId: tasting.id,
            flightId,
            completedAt: new Date().toISOString(),
            allCompleted,
          });
          for (const client of joinRooms.get(tasting.id) || []) {
            if (client.readyState === 1) {
              try { client.send(payload); } catch {}
            }
          }
          if (allCompleted) {
            const payloadStatus = JSON.stringify({ type: 'tasting_status', status: 'completed', tastingId: tasting.id, timestamp: new Date().toISOString() });
            for (const client of joinRooms.get(tasting.id) || []) {
              if (client.readyState === 1) { try { client.send(payloadStatus); } catch {} }
            }
          }
        }
      } catch {}

      // Broadcast scores_updated for schnelle Anzeige
      if (joinRooms.has(tasting.id)) {
        const payloadScores = JSON.stringify({ type: 'scores_updated', tastingId: tasting.id, flightId });
        for (const client of joinRooms.get(tasting.id) || []) {
          if (client.readyState === 1) { try { client.send(payloadScores); } catch {} }
        }
      }

      res.json(updatedFlight);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Add a wine to a flight
  app.post("/api/flights/:id/wines", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      
      // Get the flight
      const flights = Array.from(await storage.getAllTastings())
        .flatMap(async (tasting) => {
          return await storage.getFlightsByTasting(tasting.id);
        });
      
      const flight = (await Promise.all(flights)).flat().find(f => f.id === flightId);
      
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      
      // Get the tasting
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }

      // Block adding wines if the flight is completed or all flights are completed for this tasting
      const flightsOfTasting = await storage.getFlightsByTasting(tasting.id);
      const tastingHasFlights = flightsOfTasting.length > 0;
      const tastingAllCompleted = tastingHasFlights && flightsOfTasting.every(f => !!f.completedAt);
      if (flight.completedAt || tastingAllCompleted) {
        return res.status(400).json({ error: 'Weine können nicht hinzugefügt werden, da der Flight oder die Verkostung abgeschlossen ist.' });
      }
      
      // Im Entwicklungsmodus Zugriff erlauben
      // This is for development only
      
      // Get existing wines to determine next letter code
      const existingWines = await storage.getWinesByFlight(flightId);
      const letterCodeIndex = existingWines.length;
      const letterCode = String.fromCharCode(65 + letterCodeIndex); // A, B, C, etc.
      
      // Validate wine data
      const wineData = insertWineSchema.parse({
        ...req.body,
        flightId,
        letterCode
      });
      
      const wine = await storage.createWine(wineData);
      res.status(201).json(wine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  // Get wines for a flight
  app.get("/api/flights/:id/wines", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      
      const wines = await storage.getWinesByFlight(flightId);
      res.json(wines);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Delete a wine (only if its flight not started/completed and requester is host)
  app.delete('/api/wines/:id', ensureAuthenticated, async (req, res) => {
    try {
      const wineId = parseInt(req.params.id, 10);
      const wineRows = await db.select().from(wines).where(eq(wines.id, wineId)).limit(1);
      const wine = wineRows[0];
      if (!wine) return res.status(404).json({ error: 'Wine not found' });
      const flightRows = await db.select().from(flights).where(eq(flights.id, wine.flightId)).limit(1);
      const flight = flightRows[0];
      if (!flight) return res.status(404).json({ error: 'Flight not found' });
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });
      if (tasting.hostId !== req.user!.id) return res.status(403).json({ error: 'Only host can delete wines' });
      if (flight.startedAt || flight.completedAt) return res.status(400).json({ error: 'Cannot delete wine from started or completed flight' });
      await db.delete(wines).where(eq(wines.id, wineId));
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete a flight (only if not started/completed and requester is host)
  app.delete('/api/flights/:id', ensureAuthenticated, async (req, res) => {
    try {
      const flightId = parseInt(req.params.id, 10);
      const flightRows = await db.select().from(flights).where(eq(flights.id, flightId)).limit(1);
      const flight = flightRows[0];
      if (!flight) return res.status(404).json({ error: 'Flight not found' });
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });
      if (tasting.hostId !== req.user!.id) return res.status(403).json({ error: 'Only host can delete flights' });
      if (flight.startedAt || flight.completedAt) return res.status(400).json({ error: 'Cannot delete started or completed flight' });
      // Delete wines of this flight first
      await db.delete(wines).where(eq(wines.flightId, flightId));
      // Delete flight
      await db.delete(flights).where(eq(flights.id, flightId));
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // Host review data for a flight
  app.get('/api/flights/:id/review', ensureAuthenticated, async (req, res) => {
    try {
      const flightId = parseInt(req.params.id, 10);
      const flRows = await db.select().from(flights).where(eq(flights.id, flightId)).limit(1);
      const fl = flRows[0];
      if (!fl) return res.status(404).json({ error: 'Flight not found' });
      const tasting = await storage.getTasting(fl.tastingId);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });
      if (tasting.hostId !== req.user!.id) return res.status(403).json({ error: 'Only the host can review guesses' });
      const wineRows = await db.select().from(wines).where(eq(wines.flightId, flightId));
      const participants = await storage.getParticipantsByTasting(tasting.id);
      // Pull all guesses for wines of this flight
      const wineIds = wineRows.map(w => w.id);
      const guessesRes = wineIds.length ? await db.execute(sql`
        SELECT g.*, p.user_id as "userId", p.id as "participantId"
        FROM guesses g
        JOIN participants p ON p.id = g.participant_id
        WHERE g.wine_id = ANY(ARRAY[${sql.join(wineIds, sql`, `)}]::int4[])
      `) : { rows: [] };
      const guesses = (guessesRes.rows as any[]) || [];
      // Group by wine
      const grouped = wineRows.map(w => ({
        wine: w,
        guesses: guesses.filter(g => (g as any).wine_id === w.id).map(g => ({
          ...g,
          autoScore: (g as any).score - (((g as any).override_score ?? 0)),
        }))
      }));
      res.json({ flight: { id: fl.id, reviewApprovedAt: (fl as any).reviewApprovedAt || null }, wines: grouped, participants });
    } catch (e) {
      console.error('Error in /api/flights/:id/review:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Override a single guess (host only) – set overrideScore or flags/reason
  app.patch('/api/guesses/:id/override', ensureAuthenticated, async (req, res) => {
    try {
      const guessId = parseInt(req.params.id, 10);
      const body = req.body || {};
      // Load guess, wine, flight, tasting
      const guessRes = await db.execute(sql`SELECT * FROM guesses WHERE id = ${guessId} LIMIT 1`);
      const guess = (guessRes.rows as any[])[0];
      if (!guess) return res.status(404).json({ error: 'Guess not found' });
      const wineRes = await db.execute(sql`SELECT * FROM wines WHERE id = ${(guess as any).wine_id} LIMIT 1`);
      const wine = (wineRes.rows as any[])[0];
      if (!wine) return res.status(404).json({ error: 'Wine not found' });
      const flightRes = await db.execute(sql`SELECT * FROM flights WHERE id = ${(wine as any).flight_id} LIMIT 1`);
      const fl = (flightRes.rows as any[])[0];
      if (!fl) return res.status(404).json({ error: 'Flight not found' });
      const tasting = await storage.getTasting((fl as any).tasting_id);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });
      if (tasting.hostId !== req.user!.id) return res.status(403).json({ error: 'Only the host can override guesses' });

      // Compute base score fresh using current scoring rules
      const rules = await storage.getScoringRule((tasting as any).id);
      const eqTxt = (a?: string | null, b?: string | null) =>
        (a ?? '').toString().trim().toLowerCase() === (b ?? '').toString().trim().toLowerCase();
      const eqVintage = (a?: string | null, b?: string | null) => {
        const aa = (a ?? '').toString().trim();
        const bb = (b ?? '').toString().trim();
        return aa === bb || Number(aa) === Number(bb);
      };
      let base = 0;
      if (rules) {
        if ((guess as any).country && eqTxt((wine as any).country, (guess as any).country)) base += rules.country;
        if ((guess as any).region && eqTxt((wine as any).region, (guess as any).region)) base += rules.region;
        if ((guess as any).producer && eqTxt((wine as any).producer, (guess as any).producer)) base += rules.producer;
        if ((guess as any).name && eqTxt((wine as any).name, (guess as any).name)) base += rules.wineName;
        if ((guess as any).vintage && eqVintage((wine as any).vintage, (guess as any).vintage)) base += rules.vintage;
        if (rules.varietals && rules.varietals > 0) {
          const gw = ((guess as any).varietals || []).map((v: string) => v.toLowerCase());
          const ww = ((wine as any).varietals || []).map((v: string) => v.toLowerCase());
          if (rules.anyVarietalPoint) {
            const matched = gw.filter((v: string) => ww.includes(v)).length;
            base += matched * rules.varietals;
          } else {
            const gws = gw.slice().sort();
            const wws = ww.slice().sort();
            if (gws.length === wws.length && gws.every((v: string, i: number) => v === wws[i])) base += rules.varietals;
          }
        }
      }
      const prevOverride = (guess as any).override_score ?? 0;
      const newOverride = typeof body.overrideScore === 'number' ? body.overrideScore : prevOverride;
      const newScore = base + newOverride;
      const delta = newScore - (guess as any).score;

      await db.execute(sql`
        UPDATE guesses
        SET override_score = ${newOverride}, override_by = ${req.user!.id}, override_reason = ${body.overrideReason ?? null}, override_flags = ${body.overrideFlags ?? null}, score = ${newScore}
        WHERE id = ${guessId}
      `);

      // update participant score by delta
      await db.execute(sql`
        UPDATE participants SET score = COALESCE(score,0) + ${delta} WHERE id = ${(guess as any).participant_id}
      `);

      // Broadcast score update to all clients of this tasting
      try {
        if (joinRooms.has(tasting.id)) {
          const payloadScores = JSON.stringify({ type: 'scores_updated', tastingId: tasting.id, flightId: (wine as any).flight_id });
          for (const client of joinRooms.get(tasting.id) || []) {
            if ((client as any).readyState === 1) { try { (client as any).send(payloadScores); } catch {}
            }
          }
        }
      } catch {}

      res.json({ ok: true, newScore, delta });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Approve review for a flight
  app.post('/api/flights/:id/review/approve', ensureAuthenticated, async (req, res) => {
    try {
      const flightId = parseInt(req.params.id, 10);
      const flRows = await db.select().from(flights).where(eq(flights.id, flightId)).limit(1);
      const fl = flRows[0];
      if (!fl) return res.status(404).json({ error: 'Flight not found' });
      const tasting = await storage.getTasting(fl.tastingId);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });
      if (tasting.hostId !== req.user!.id) return res.status(403).json({ error: 'Only the host can approve review' });
      const now = new Date();
      await db.execute(sql`UPDATE flights SET review_approved_at = ${now} WHERE id = ${flightId}`);
      // Broadcast scores_updated for immediate refresh
      if (joinRooms.has(tasting.id)) {
        const payloadScores = JSON.stringify({ type: 'scores_updated', tastingId: tasting.id, flightId });
        for (const client of joinRooms.get(tasting.id) || []) {
          if (client.readyState === 1) { try { client.send(payloadScores); } catch {} }
        }
      }
      res.json({ ok: true, reviewApprovedAt: now });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Join a tasting
  app.post("/api/tastings/:id/join", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // Accept both "active" (lobby/registration open) and "started" (running)
      // - active: allow join (respect password/invite) and create participant if needed
      // - started: only allow if the user is already a participant (resume)

      // Check if user is already a participant (used in both branches)
      const existingParticipant = await storage.getParticipant(tastingId, userId);

      if (tasting.status === "active") {
        // Check if the tasting requires a password
        if (!tasting.isPublic && tasting.password) {
          const { password } = req.body;
          if (!password || password !== tasting.password) {
            return res.status(403).json({ error: "Invalid password" });
          }
        }
        
        // Check if the tasting is private and user is invited
        if (!tasting.isPublic && !tasting.password) {
          const invitees = await storage.getTastingInvitees(tastingId);
          const userEmail = req.user!.email;
          
          if (!invitees.some(invitee => invitee.email.toLowerCase() === userEmail.toLowerCase())) {
            return res.status(403).json({ error: "You are not invited to this tasting" });
          }
        }

        if (!existingParticipant) {
          // Get user to get the name
          const user = await storage.getUser(userId);
          if (!user) {
            return res.status(404).json({ error: "User not found" });
          }
          const { name } = req.body;
          await storage.createParticipant({
            tastingId,
            userId,
            name: name || user.name || ''
          });
        }
      } else if (tasting.status === "started") {
        // Only allow re-join if already a participant
        if (!existingParticipant) {
          return res.status(403).json({ error: "Tasting already started; you are not a participant" });
        }
        // Otherwise OK: resume without password/invite gating
      } else if (tasting.status === "completed") {
        return res.status(400).json({ error: "Tasting is completed" });
      } else {
        return res.status(400).json({ error: "Tasting is not active" });
      }

      // Hole die aktualisierte Teilnehmerliste
      const participants = await storage.getParticipantsByTasting(tastingId);
      
      // Sende die aktualisierte Teilnehmerliste an alle verbundenen Clients
      const sockets = joinRooms.get(tastingId);
      if (sockets && sockets.size > 0) {
        const newParticipant = participants.find(p => p.userId === userId);
        
        // Erstelle die Broadcast-Nachricht für alle Clients
        const message = JSON.stringify({
          type: 'participants_updated',
          participants: participants,
          newParticipant: newParticipant
        });

        // Sende die Nachricht an alle verbundenen Clients
        const socketsToRemove: WebSocket[] = [];
        
        sockets.forEach(ws => {
          try {
            if (ws.readyState === ws.OPEN) {
              ws.send(message);
            } else if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
              // Markiere geschlossene Verbindungen zur Entfernung
              socketsToRemove.push(ws);
            }
          } catch (error) {
            console.error('Fehler beim Senden der WebSocket-Nachricht:', error);
            socketsToRemove.push(ws);
          }
        });

        // Entferne geschlossene Verbindungen
        if (socketsToRemove.length > 0) {
          const room = joinRooms.get(tastingId);
          if (room) {
            socketsToRemove.forEach(ws => room.delete(ws));
            if (room.size === 0) {
              joinRooms.delete(tastingId);
            }
          }
        }
      }
      
      // Return success response
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get participants for a tasting
  app.get("/api/tastings/:id/participants", ensureAuthenticated, async (req, res) => {
    try {
      const participants = await storage.getParticipantsByTasting(parseInt(req.params.id));
      res.json(participants);
    } catch (error) {
      console.error('Error fetching participants:', error);
      res.status(500).json({ error: 'Error fetching participants' });
    }
  });

  // Remove participant from tasting (host only)
  app.delete("/api/tastings/:tastingId/participants/:userId", ensureAuthenticated, async (req, res) => {
    // Log the request for debugging
    const requestInfo = {
      method: req.method,
      url: req.url,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };
    console.log('Remove participant request:', requestInfo);

    try {
      // Parse and validate IDs
      const tastingId = parseInt(req.params.tastingId, 10);
      const userId = parseInt(req.params.userId, 10);
      
      if (isNaN(tastingId) || isNaN(userId)) {
        const errorMsg = 'Ungültige Tasting-ID oder Benutzer-ID';
        console.error(errorMsg, { 
          tastingId: req.params.tastingId, 
          userId: req.params.userId,
          ...requestInfo
        });
        return res.status(400).json({ error: errorMsg });
      }

      // Check if user is authenticated
      if (!req.user) {
        const errorMsg = 'Nicht authentifizierter Benutzer';
        console.error(errorMsg, requestInfo);
        return res.status(401).json({ error: errorMsg });
      }
      
      // Check if tasting exists
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        const errorMsg = 'Tasting nicht gefunden';
        console.error(errorMsg, { tastingId, ...requestInfo });
        return res.status(404).json({ error: errorMsg });
      }
      
      // Check if user is the host
      if (tasting.hostId !== req.user.id) {
        const errorMsg = 'Nur der Veranstalter kann Teilnehmer entfernen';
        console.error(errorMsg, { 
          userId: req.user.id, 
          tastingId,
          hostId: tasting.hostId,
          ...requestInfo 
        });
        return res.status(403).json({ error: errorMsg });
      }
      
      // Prevent self-removal
      if (userId === req.user.id) {
        const errorMsg = 'Sie können sich nicht selbst entfernen';
        console.error(errorMsg, { userId, ...requestInfo });
        return res.status(400).json({ error: errorMsg });
      }
      
      // Remove participant with additional logging
      console.log('Versuche Teilnehmer zu entfernen:', { 
        tastingId, 
        userId,
        typeTastingId: typeof tastingId,
        typeUserId: typeof userId,
        ...requestInfo 
      });
      
      try {
        // Convert to strings to ensure consistent handling in storage layer
        const tastingIdStr = String(tastingId);
        const userIdStr = String(userId);
        
        console.log('Konvertierte IDs für removeParticipant:', {
          original: { tastingId, userId },
          converted: { tastingId: tastingIdStr, userId: userIdStr }
        });
        
        const removed = await storage.removeParticipant(tastingIdStr, userIdStr);
        
        if (!removed) {
          const errorMsg = 'Teilnehmer konnte nicht entfernt werden';
          console.error(errorMsg, { 
            tastingId, 
            userId,
            typeTastingId: typeof tastingId,
            typeUserId: typeof userId,
            ...requestInfo 
          });
          return res.status(404).json({ error: 'Teilnehmer nicht gefunden' });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
        console.error('Fehler beim Aufruf von storage.removeParticipant:', {
          error: errorMsg,
          stack: error instanceof Error ? error.stack : undefined,
          tastingId,
          userId,
          typeTastingId: typeof tastingId,
          typeUserId: typeof userId,
          ...requestInfo
        });
        return res.status(400).json({ error: 'Ungültige Parameter beim Entfernen des Teilnehmers' });
      }
      
      // Notify all clients in the tasting room via WebSocket
      if (joinRooms.has(tastingId)) {
        const message = JSON.stringify({
          type: 'participant_removed',
          userId: userId,
          timestamp: new Date().toISOString()
        });
        
        // Send message to all connected clients
        const clients = joinRooms.get(tastingId) || [];
        for (const client of clients) {
          if (client.readyState === 1) {
            try {
              client.send(message);
            } catch (error: unknown) {
              const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
              console.error('Fehler beim Senden der WebSocket-Nachricht:', errorMsg, {
                clientId: client.url,
                ...requestInfo
              });
            }
          }
        }
      }
      
      console.log('Teilnehmer erfolgreich entfernt', { tastingId, userId, ...requestInfo });
      res.status(200).json({ success: true });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error('Fehler beim Entfernen des Teilnehmers:', errorMsg, requestInfo);
      res.status(500).json({ error: 'Interner Serverfehler beim Entfernen des Teilnehmers' });
    }
  });

  // Leave tasting (participant self-removal)
  app.post("/api/tastings/:id/leave", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id, 10);
      const userId = req.user!.id;
      if (isNaN(tastingId)) return res.status(400).json({ error: 'Ungültige Tasting-ID' });

      const removed = await storage.removeParticipant(String(tastingId), String(userId));
      // Wenn bereits entfernt, antworte trotzdem ok, um Fehler im Client zu vermeiden
      if (!removed) return res.json({ ok: false });

      // Notify waiting room clients
      if (joinRooms.has(tastingId)) {
        const message = JSON.stringify({ type: 'participant_removed', userId, timestamp: new Date().toISOString() });
        const clients = joinRooms.get(tastingId) || [];
        for (const client of clients) {
          if (client.readyState === 1) {
            try { client.send(message); } catch {}
          }
        }
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error('Error leaving tasting:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // Submit a guess for a wine
  app.post("/api/wines/:id/guess", ensureAuthenticated, async (req, res) => {
    try {
      const wineId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Get the wine
      const wine = await storage.getWineById(wineId);
      if (!wine) {
        return res.status(404).json({ error: "Wine not found" });
      }
      
      // Get the flight
      const flights = Array.from(await storage.getAllTastings())
        .flatMap(async (tasting) => {
          return await storage.getFlightsByTasting(tasting.id);
        });
      
      const flight = (await Promise.all(flights)).flat().find(f => f.id === wine.flightId);
      
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      
      // Get the tasting
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // Allow guesses when tasting is active or started and the flight is not completed yet.
      // Only block if the flight is completed or the tasting is completed.
      if (flight.completedAt || tasting.status === 'completed') {
        return res.status(400).json({ error: "Flight is not active" });
      }
      
      // Check if the user is a participant
      const participant = await storage.getParticipant(tasting.id, userId);
      if (!participant) {
        return res.status(403).json({ error: "You are not a participant in this tasting" });
      }
      
      // Validate guess data
      const guessData = insertGuessSchema.parse({
        ...req.body,
        participantId: participant.id,
        wineId
      });
      
      const guess = await storage.createGuess(guessData);
      res.status(201).json(guess);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  // Get guesses for a participant
  app.get("/api/participants/:id/guesses", ensureAuthenticated, async (req, res) => {
    try {
      const participantId = parseInt(req.params.id);
      
      // Get the participant
      const participants = Array.from(await storage.getAllTastings())
        .flatMap(async (tasting) => {
          return await storage.getParticipantsByTasting(tasting.id);
        });
      
      const participant = (await Promise.all(participants)).flat().find(p => p.id === participantId);
      
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      
      // Check if the user is the participant or the host
      const userId = req.user!.id;
      const tasting = await storage.getTasting(participant.tastingId);
      
      if (participant.userId !== userId && tasting?.hostId !== userId) {
        return res.status(403).json({ error: "You are not authorized to see these guesses" });
      }
      
      const guesses = await storage.getGuessesByParticipant(participantId);
      
      // Add wine info to each guess
      const guessesWithWineInfo = await Promise.all(
        guesses.map(async (guess) => {
          const wine = await storage.getWineById(guess.wineId);
          return { ...guess, wine };
        })
      );
      
      res.json(guessesWithWineInfo);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Guess stats per wine for a flight (host view) – robust against partial data
  app.get('/api/flights/:id/guess-stats', ensureAuthenticated, async (req, res) => {
    try {
      const flightId = parseInt(req.params.id, 10);
      if (isNaN(flightId)) return res.status(400).json({ error: 'Invalid flight id' });

      const [flightRow] = await db.select().from(flights).where(eq(flights.id, flightId)).limit(1);
      if (!flightRow) return res.status(404).json({ error: 'Flight not found' });
      const tasting = await storage.getTasting(flightRow.tastingId);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });
      if (req.user?.id !== tasting.hostId) return res.status(403).json({ error: 'Only the host can view guess stats' });

      const wineRows = await db.select().from(wines).where(eq(wines.flightId, flightId));
      if (!wineRows || wineRows.length === 0) {
        return res.json({ flightId, tastingId: tasting.id, stats: [] });
      }

      const totalParticipantsRes = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM participants WHERE tasting_id = ${tasting.id}`);
      const totalParticipants = (totalParticipantsRes.rows?.[0] as any)?.cnt ?? 0;

      // Safer count per wine
      const countsRes = await db.execute(sql`
        SELECT w.id as "wineId", w.letter_code as "letterCode",
               COALESCE(COUNT(DISTINCT g.participant_id),0)::int AS "submitted"
        FROM wines w
        LEFT JOIN guesses g ON g.wine_id = w.id
        WHERE w.flight_id = ${flightId}
        GROUP BY w.id, w.letter_code
        ORDER BY w.id
      `);

      const countsMap = new Map<number, { submitted: number; letterCode: string }>();
      for (const row of (countsRes.rows as any[]) || []) countsMap.set(row.wineId, { submitted: row.submitted, letterCode: row.letterCode });

      const stats = wineRows.map(w => {
        const row = countsMap.get(w.id);
        const submitted = row?.submitted ?? 0;
        const letterCode = row?.letterCode ?? (w as any).letterCode;
        return { wineId: w.id, letterCode, submitted, total: totalParticipants, missing: Math.max(totalParticipants - submitted, 0) };
      });

      return res.json({ flightId, tastingId: tasting.id, stats });
    } catch (error) {
      console.error('Error fetching guess stats:', error);
      // Return empty stats instead of 500 to not block UI
      try {
        const flightId = parseInt(req.params.id, 10);
        const [flightRow] = await db.select().from(flights).where(eq(flights.id, flightId)).limit(1);
        const tastingId = flightRow ? flightRow.tastingId : null;
        return res.json({ flightId, tastingId, stats: [] });
      } catch {
        return res.json({ flightId: null, tastingId: null, stats: [] });
      }
    }
  });

  // Detailed performance statistics per flight (host view)
  app.get('/api/flights/:id/stats', ensureAuthenticated, async (req, res) => {
    try {
      const flightId = parseInt(req.params.id, 10);
      if (isNaN(flightId)) return res.status(400).json({ error: 'Invalid flight id' });

      // Fetch flight and tasting
      const flightRows = await db
        .select()
        .from(flights)
        .where(eq(flights.id, flightId))
        .limit(1);
      const flight = flightRows[0];
      if (!flight) return res.status(404).json({ error: 'Flight not found' });

      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });

      if (req.user?.id !== tasting.hostId) {
        return res.status(403).json({ error: 'Only the host can view flight stats' });
      }

      // Participants count
      const totalParticipantsRes = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM participants WHERE tasting_id = ${tasting.id}`);
      const totalParticipants = (totalParticipantsRes.rows?.[0] as any)?.cnt ?? 0;

      // Top scorer of this flight
      const topScorerRes = await db.execute(sql`
        SELECT p.id as "participantId", u.name as "userName", COALESCE(SUM(g.score), 0)::int AS "score"
        FROM participants p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN guesses g ON g.participant_id = p.id
        LEFT JOIN wines w ON w.id = g.wine_id AND w.flight_id = ${flightId}
        WHERE p.tasting_id = ${tasting.id}
        GROUP BY p.id, u.name
        ORDER BY "score" DESC, u.name ASC
        LIMIT 1
      `);
      const topScorer = (topScorerRes.rows?.[0] as any) || null;

      // Recognition by wine: sum of scores per wine
      const recogRes = await db.execute(sql`
        SELECT w.id as "wineId", w.letter_code as "letterCode", w.producer, w.name,
               COALESCE(SUM(g.score), 0)::int AS "totalScore"
        FROM wines w
        LEFT JOIN guesses g ON g.wine_id = w.id
        WHERE w.flight_id = ${flightId}
        GROUP BY w.id, w.letter_code, w.producer, w.name
        ORDER BY w.id
      `);
      const recogRows = (recogRes.rows as any[]) || [];
      // Compute normalized average score over ALL participants
      const withAvg = recogRows.map(r => ({ ...r, avgScore: totalParticipants > 0 ? Number(r.totalScore) / totalParticipants : 0 }));
      const bestRecognizedWine = withAvg.length ? withAvg.reduce((a, b) => (a.avgScore >= b.avgScore ? a : b)) : null;
      const worstRecognizedWine = withAvg.length ? withAvg.reduce((a, b) => (a.avgScore <= b.avgScore ? a : b)) : null;

      // Ratings per wine
      const ratingRes = await db.execute(sql`
        SELECT w.id as "wineId", w.letter_code as "letterCode", w.producer, w.name,
               AVG(g.rating)::float AS "avgRating",
               COUNT(g.rating)::int AS "count"
        FROM wines w
        LEFT JOIN guesses g ON g.wine_id = w.id AND g.rating IS NOT NULL
        WHERE w.flight_id = ${flightId}
        GROUP BY w.id, w.letter_code, w.producer, w.name
      `);
      const ratingRows = (ratingRes.rows as any[]) || [];
      const bestRatedWine = ratingRows.length ? ratingRows.reduce((a, b) => ((a.avgRating ?? -Infinity) >= (b.avgRating ?? -Infinity) ? a : b)) : null;
      const worstRatedWine = ratingRows.length ? ratingRows.reduce((a, b) => ((a.avgRating ?? Infinity) <= (b.avgRating ?? Infinity) ? a : b)) : null;

      return res.json({
        flightId,
        tastingId: tasting.id,
        totalParticipants,
        topScorer,
        bestRecognizedWine,
        worstRecognizedWine,
        bestRatedWine,
        worstRatedWine,
      });
    } catch (error) {
      console.error('Error fetching flight stats:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // Final result statistics for a tasting (host view)
  app.get('/api/tastings/:id/final-stats', ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id, 10);
      if (isNaN(tastingId)) return res.status(400).json({ error: 'Invalid tasting id' });

      const tasting = await storage.getTasting(tastingId);
      if (!tasting) return res.status(404).json({ error: 'Tasting not found' });
      if (req.user?.id !== tasting.hostId) {
        return res.status(403).json({ error: 'Only the host can view final stats' });
      }

      // Ensure all flights completed
      const flightsList = await storage.getFlightsByTasting(tastingId);
      const allCompleted = flightsList.length > 0 && flightsList.every(f => !!f.completedAt);
      if (!allCompleted) {
        return res.status(400).json({ error: 'Final stats are available after all flights are completed' });
      }

      // Participant count
      const totalParticipantsRes = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM participants WHERE tasting_id = ${tastingId}`);
      const totalParticipants = (totalParticipantsRes.rows?.[0] as any)?.cnt ?? 0;

      // Recognition across all wines of the tasting
      const recogRes = await db.execute(sql`
        SELECT w.id as "wineId", w.letter_code as "letterCode", w.producer, w.name,
               COALESCE(SUM(g.score), 0)::int AS "totalScore"
        FROM wines w
        JOIN flights f ON f.id = w.flight_id AND f.tasting_id = ${tastingId}
        LEFT JOIN guesses g ON g.wine_id = w.id
        GROUP BY w.id, w.letter_code, w.producer, w.name
      `);
      const recogRows = (recogRes.rows as any[]) || [];
      const withAvg = recogRows.map(r => ({ ...r, avgScore: totalParticipants > 0 ? Number(r.totalScore) / totalParticipants : 0 }));
      const bestRecognizedWine = withAvg.length ? withAvg.reduce((a, b) => (a.avgScore >= b.avgScore ? a : b)) : null;
      const worstRecognizedWine = withAvg.length ? withAvg.reduce((a, b) => (a.avgScore <= b.avgScore ? a : b)) : null;

      // Ratings across all wines
      const ratingRes = await db.execute(sql`
        SELECT w.id as "wineId", w.letter_code as "letterCode", w.producer, w.name,
               AVG(g.rating)::float AS "avgRating",
               COUNT(g.rating)::int AS "count"
        FROM wines w
        JOIN flights f ON f.id = w.flight_id AND f.tasting_id = ${tastingId}
        LEFT JOIN guesses g ON g.wine_id = w.id AND g.rating IS NOT NULL
        GROUP BY w.id, w.letter_code, w.producer, w.name
      `);
      const ratingRows = (ratingRes.rows as any[]) || [];
      const bestRatedWine = ratingRows.length ? ratingRows.reduce((a, b) => ((a.avgRating ?? -Infinity) >= (b.avgRating ?? -Infinity) ? a : b)) : null;
      const worstRatedWine = ratingRows.length ? ratingRows.reduce((a, b) => ((a.avgRating ?? Infinity) <= (b.avgRating ?? Infinity) ? a : b)) : null;

      return res.json({
        tastingId,
        totalParticipants,
        bestRecognizedWine,
        worstRecognizedWine,
        bestRatedWine,
        worstRatedWine,
      });
    } catch (error) {
      console.error('Error fetching final stats:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // Ändere von API- zu Datenbank-Suche
  app.get('/api/wines/search', async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Invalid query' });
    }
    
    try {
      const results = await storage.searchWines(q);
      res.json(results);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Endpoint to get all wines from vinaturel.de API
  app.get("/api/wines/all", async (req, res) => {
    try {
      // Use vinaturel API
      const credentials = {
        username: process.env.VINATUREL_USERNAME || 'verena.oleksyn@web.de',
        password: process.env.VINATUREL_PASSWORD || 'Vinaturel123',
        apiKey: process.env.VINATUREL_API_KEY || 'SWSCT5QYLV9K9CQMJ_XI1Q176W'
      };
      
      console.log('Fetching all wines from Vinaturel API');
      const wines = await VinaturelAPI.fetchWines(credentials);
      console.log(`Found ${wines.length} wines from Vinaturel API`);
      
      return res.json(wines);
    } catch (error) {
      console.error('Error fetching all wines:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/debug/db-check', async (req, res) => {
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const pgResult = await pool.query('SELECT 1+1 AS result');
      await pool.end();
      
      const drizzleResult = await db.select().from(users).limit(1);
      
      res.json({
        pgConnection: pgResult.rows[0].result === 2 ? 'OK' : 'FEHLER',
        drizzleConnection: drizzleResult.length > 0 ? 'OK' : 'FEHLER',
        env: {
          DATABASE_URL: process.env.DATABASE_URL ? 'gesetzt' : 'nicht gesetzt',
          NODE_ENV: process.env.NODE_ENV
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      res.status(500).json({
        error: errorMessage,
        stack: errorStack,
        rawError: error instanceof Error ? error.toString() : 'Unbekannter Fehler'
      });
    }
  });

  // Debug: return tasting status (flights, participants, scoring, computed flags)
  app.get('/api/debug/tasting/:id/status', async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id, 10);
      if (isNaN(tastingId)) return res.status(400).json({ error: 'invalid tasting id' });

      const tasting = await storage.getTasting(tastingId);
      if (!tasting) return res.status(404).json({ error: 'tasting not found' });

      const flightsList = await storage.getFlightsByTasting(tastingId);
      const participantsList = await storage.getParticipantsByTasting(tastingId);
      const rules = await storage.getScoringRule(tastingId);

      const totalFlights = flightsList.length;
      // Completed only considers started flights
      const startedOpen = flightsList.filter(f => f.startedAt && !f.completedAt).length;
      const allCompletedRule = totalFlights === 1 || startedOpen === 0;

      res.json({
        tasting: { id: tasting.id, status: tasting.status },
        flights: flightsList,
        participants: participantsList.map(p => ({ id: p.id, userId: p.userId, score: p.score })),
        scoringRules: rules || null,
        computed: {
          totalFlights,
          startedOpen,
          allCompletedRule,
        },
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/tastings/:id/password', async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const { password } = req.body;
      
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      if (tasting.password && tasting.password !== password) {
        return res.status(401).json({ error: "Invalid Password" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error joining tasting:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete tasting
  app.delete("/api/tastings/:id", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      await storage.deleteTasting(tastingId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  // WebSocket server for live participant updates on join page
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/join' });
  wss.on('connection', async (socket, req) => {
    try {
      // Parse query parameters
      const query = req.url?.split('?')[1] || '';
      const params = new URLSearchParams(query);
      const tastingId = parseInt(params.get('t') || '', 10);
      const isHost = params.get('host') === 'true';
      const userIdParam = params.get('u');
      const userIdFromQuery = userIdParam ? parseInt(userIdParam, 10) : undefined;
      
      if (isNaN(tastingId)) {
        console.error('Ungültige Tasting-ID:', tastingId);
        socket.close();
        return;
      }

      // Initialisiere den Raum, falls nicht vorhanden
      if (!joinRooms.has(tastingId)) {
        joinRooms.set(tastingId, new Set());
      }

      // Füge den Socket zum Raum hinzu
      joinRooms.get(tastingId)!.add(socket);
      
      console.log(`Neue WebSocket-Verbindung für Tasting ${tastingId} (${isHost ? 'Host' : 'Teilnehmer'})`);

      // Sende die aktuelle Teilnehmerliste an den Client
      try {
        const participants = await storage.getParticipantsByTasting(tastingId);
        const message = JSON.stringify({
          type: 'participants_updated',
          participants: participants
        });
        
        if (socket.readyState === socket.OPEN) {
          socket.send(message);
        }
      } catch (error) {
        console.error('Fehler beim Abrufen der Teilnehmerliste:', error);
      }

      // Cleanup bei Verbindungsabbruch
      socket.on('close', async () => {
        const room = joinRooms.get(tastingId);
        if (room) {
          room.delete(socket);
          console.log(`Verbindung für Tasting ${tastingId} geschlossen (${isHost ? 'Host' : 'Teilnehmer'})`);
          
          // Entferne leere Räume
          if (room.size === 0) {
            joinRooms.delete(tastingId);
          }
        }
      });

      // Fehlerbehandlung
      socket.on('error', (error) => {
        console.error('WebSocket-Fehler:', error);
      });

    } catch (err) {
      console.error('Fehler bei der WebSocket-Verbindung:', err);
      if (socket.readyState === socket.OPEN) {
        socket.close();
      }
    }
  });

  return httpServer;
}
