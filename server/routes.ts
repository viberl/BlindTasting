import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import axios from "axios";
import {
  insertTastingSchema,
  insertScoringRuleSchema,
  insertFlightSchema,
  insertWineSchema,
  insertGuessSchema,
  insertParticipantSchema
} from "@shared/schema";

// Helper function to ensure user is authenticated
function ensureAuthenticated(req: Request, res: Response, next: Function) {
  console.log("Checking authentication for:", req.path, "Session ID:", req.sessionID);
  
  // Prüfe zuerst die Standard-Passport-Authentifizierung
  if (req.isAuthenticated()) {
    console.log("User is authenticated via passport, user ID:", (req.user as any)?.id);
    return next();
  }
  
  // Alternativ prüfen wir auch die Session-Variable, die wir gesetzt haben
  if (req.session && req.session.userId) {
    console.log("User is authenticated via session variable, user ID:", req.session.userId);
    // Hier könnten wir auch den Benutzer aus der DB laden und req.user setzen
    return next();
  }
  
  // TEMPORÄRE LÖSUNG FÜR ENTWICKLUNG - NICHT FÜR PRODUKTION
  // In der Entwicklung erlauben wir alle Anfragen für API-Endpunkte
  if (process.env.NODE_ENV === 'development') {
    console.log("DEV MODE: Allowing access without authentication");
    return next();
  }
  
  console.log("Auth check failed: User is not authenticated", { 
    sessionID: req.sessionID,
    userInSession: !!req.session.userId,
    hasUser: !!req.user,
    isAuthenticated: req.isAuthenticated(),
    cookies: req.headers.cookie
  });
  
  res.status(401).json({ message: "Unauthorized - Sie müssen angemeldet sein" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Vinaturel API integration for wine data
  app.get("/api/vinaturel/wines", ensureAuthenticated, async (req, res) => {
    try {
      const { VinaturelAPI } = require('./vinaturel-api');
      const credentials = {
        username: process.env.VINATUREL_USERNAME || 'verena.oleksyn@web.de',
        password: process.env.VINATUREL_PASSWORD || 'Vinaturel123',
        apiKey: process.env.VINATUREL_API_KEY || 'SWSCT5QYLV9K9CQMJ_XI1Q176W'
      };
      
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      
      const wines = await VinaturelAPI.fetchWines(credentials, limit, page);
      res.json(wines);
    } catch (error) {
      console.error('Error fetching Vinaturel wines:', error);
      res.status(500).json({ error: 'Failed to fetch wines from Vinaturel' });
    }
  });

  // Get user's tastings (both hosted and participating)
  app.get("/api/tastings", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const hostedTastings = await storage.getHostedTastings(userId);
      const availableTastings = await storage.getUserTastings(userId);
      
      // Get participating tastings (where the user is a participant)
      const participatingTastings: typeof availableTastings = [];
      for (const tasting of availableTastings) {
        const participant = await storage.getParticipant(tasting.id, userId);
        if (participant) {
          participatingTastings.push(tasting);
        }
      }
      
      res.json({
        hosted: hostedTastings,
        participating: participatingTastings,
        available: availableTastings.filter(t => 
          !hostedTastings.some(h => h.id === t.id) && 
          !participatingTastings.some(p => p.id === t.id)
        )
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Create a new tasting
  app.post("/api/tastings", ensureAuthenticated, async (req, res) => {
    try {
      // In der Entwicklung können wir die hostId direkt vom Client akzeptieren
      // oder einen Default-Wert von 1 verwenden, wenn kein Benutzer authentifiziert ist
      let userId: number;
      
      if (req.user && req.user.id) {
        userId = req.user.id;
        console.log("Verwende authentifizierten Benutzer:", userId);
      } else if (req.body.hostId) {
        userId = req.body.hostId;
        console.log("Verwende Client-Benutzer-ID:", userId);
      } else {
        // Default auf ID 1 für Entwicklung
        userId = 1;
        console.log("Verwende Default-Benutzer-ID:", userId);
      }
      
      // Validate tasting data
      const tastingData = insertTastingSchema.parse({
        ...req.body,
        hostId: userId
      });
      
      const tasting = await storage.createTasting(tastingData);
      
      // If it's private, add invitees
      if (!tasting.isPublic && req.body.invitees) {
        const invitees: string[] = req.body.invitees;
        for (const email of invitees) {
          await storage.addTastingInvitee({ 
            tastingId: tasting.id, 
            email 
          });
        }
      }
      
      res.status(201).json(tasting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  // Get a specific tasting
  app.get("/api/tastings/:id", async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const tasting = await storage.getTasting(tastingId);
      
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // ENTWICKLUNGSMODUS: Erlauben Sie immer den Zugriff
      // This is for development only
      return res.json(tasting);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Update tasting status
  app.patch("/api/tastings/:id/status", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || !["draft", "active", "completed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const tasting = await storage.getTasting(tastingId);
      
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // Only the host can update the status
      if (tasting.hostId !== req.user!.id) {
        return res.status(403).json({ error: "Only the host can update the tasting status" });
      }
      
      const updatedTasting = await storage.updateTastingStatus(tastingId, status);
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
      
      // Validate scoring rule data
      const scoringRuleData = insertScoringRuleSchema.parse({
        ...req.body,
        tastingId
      });
      
      // Check if scoring rules already exist
      const existingRules = await storage.getScoringRule(tastingId);
      if (existingRules) {
        return res.status(400).json({ error: "Scoring rules already exist for this tasting" });
      }
      
      const scoringRule = await storage.createScoringRule(scoringRuleData);
      res.status(201).json(scoringRule);
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
  app.post("/api/tastings/:id/flights", async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // Im Entwicklungsmodus Zugriff erlauben
      // This is for development only
      
      // Get existing flights to determine next order index and flight number
      const existingFlights = await storage.getFlightsByTasting(tastingId);
      const orderIndex = existingFlights.length;
      const flightNumber = orderIndex + 1;
      
      // Automatisch Namen und Standardwerte generieren 
      const flightData = insertFlightSchema.parse({
        tastingId,
        orderIndex,
        name: `Runde ${flightNumber}`,
        timeLimit: 1800 // 30 minutes default
      });
      
      const flight = await storage.createFlight(flightData);
      res.status(201).json(flight);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  // Get flights for a tasting
  app.get("/api/tastings/:id/flights", async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      const flights = await storage.getFlightsByTasting(tastingId);
      
      // For each flight, get the wines
      const flightsWithWines = await Promise.all(
        flights.map(async (flight) => {
          const wines = await storage.getWinesByFlight(flight.id);
          return { ...flight, wines };
        })
      );
      
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
      res.json(updatedFlight);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Complete a flight
  app.post("/api/flights/:id/complete", async (req, res) => {
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
      
      // Update flight completion time
      const updatedFlight = await storage.updateFlightTimes(flightId, flight.startedAt || new Date(), new Date());
      
      // Calculate scores for all guesses in this flight
      const wines = await storage.getWinesByFlight(flightId);
      const participants = await storage.getParticipantsByTasting(tasting.id);
      const scoringRules = await storage.getScoringRule(tasting.id);
      
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
                if (scoringRules.anyVarietalPoint) {
                  // Award points if any varietal is correct
                  if (guess.varietals.some(v => wine.varietals.includes(v))) {
                    guessScore += scoringRules.varietals;
                  }
                } else {
                  // Award points only if all varietals match exactly
                  if (
                    guess.varietals.length === wine.varietals.length &&
                    guess.varietals.every(v => wine.varietals.includes(v))
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

  // Join a tasting
  app.post("/api/tastings/:id/join", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      // Check if the tasting is active
      if (tasting.status !== "active") {
        return res.status(400).json({ error: "Tasting is not active" });
      }
      
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
      
      // Create participant
      const participant = await storage.createParticipant({
        tastingId,
        userId
      });
      
      res.status(201).json(participant);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get participants for a tasting
  app.get("/api/tastings/:id/participants", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      
      const participants = await storage.getParticipantsByTasting(tastingId);
      
      // Add user info to each participant
      const participantsWithUserInfo = await Promise.all(
        participants.map(async (participant) => {
          const user = await storage.getUser(participant.userId);
          return { 
            ...participant, 
            user: user ? { 
              id: user.id, 
              name: user.name, 
              email: user.email 
            } : undefined 
          };
        })
      );
      
      res.json(participantsWithUserInfo);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
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
      
      // Check if the flight is active
      if (!flight.startedAt || flight.completedAt) {
        return res.status(400).json({ error: "Flight is not active" });
      }
      
      // Get the tasting
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
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

  // Endpoint to search wines from vinaturel.de API
  app.get("/api/wines/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      
      // Use vinaturel API
      const { VinaturelAPI } = require('./vinaturel-api');
      const credentials = {
        username: process.env.VINATUREL_USERNAME || 'verena.oleksyn@web.de',
        password: process.env.VINATUREL_PASSWORD || 'Vinaturel123',
        apiKey: process.env.VINATUREL_API_KEY || 'SWSCT5QYLV9K9CQMJ_XI1Q176W'
      };
      
      const wines = await VinaturelAPI.fetchWines(credentials);
      // Filter wines based on query
      const filteredWines = wines.filter((wine: any) => {
        const searchTerm = query.toLowerCase();
        return (
          wine.name.toLowerCase().includes(searchTerm) ||
          wine.producer.toLowerCase().includes(searchTerm) ||
          wine.country.toLowerCase().includes(searchTerm) ||
          wine.region.toLowerCase().includes(searchTerm) ||
          wine.varietals.some((varietal: string) => varietal.toLowerCase().includes(searchTerm))
        );
      });
      
      res.json({ wines: filteredWines });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
