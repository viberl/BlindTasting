import { eq, desc, and, or, ne, notExists, sql, inArray, ilike } from "drizzle-orm";
import { users, type User, type InsertUser } from "@shared/schema";
import { tastings, type Tasting, type InsertTasting } from "@shared/schema";
// tasting_invitees exists in initial migrations; use raw SQL access to avoid schema drift
import { tastingInvitees, type TastingInvitee, type InsertTastingInvitee } from "@shared/schema";
import { scoringRules, type ScoringRule, type InsertScoringRule } from "@shared/schema";
import { flights, type Flight, type InsertFlight } from "@shared/schema";
import { wines, type Wine, type InsertWine } from "@shared/schema";
import { participants, type Participant, type InsertParticipant } from "@shared/schema";
import { guesses, type Guess, type InsertGuess } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { Pool } from "pg";

interface TastingWithHost extends Tasting {
  hostName: string;
  hostCompany: string | null;
  requiresPassword?: boolean;
}

const tastingStore: {
  hosted: TastingWithHost[];
  participating: TastingWithHost[];
  available: TastingWithHost[];
} = {
  hosted: [],
  participating: [],
  available: []
};

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Tasting methods
  createTasting(tasting: {
    name: string;
    hostId: number;
    isPublic: boolean;
    password?: string;
    invitedEmails?: string[];
  }): Promise<Tasting>;
  getTasting(id: number): Promise<Tasting | undefined>;
  getAllTastings(): Promise<Tasting[]>;
  getPublicTastings(): Promise<Tasting[]>;
  getUserTastings(userId: number, userEmail: string): Promise<{
    hosted: TastingWithHost[];
    participating: TastingWithHost[];
    available: TastingWithHost[];
    invited: TastingWithHost[];
  }>;
  getHostedTastings(hostId: number): Promise<Tasting[]>;
  updateTasting(id: number, update: Partial<Tasting>): Promise<Tasting>;
  updateTastingStatus(id: number, status: string): Promise<Tasting>;
  deleteTasting(id: number): Promise<void>;
  
  // Tasting Invitees
  addTastingInvitee(invitee: InsertTastingInvitee & { role: string }): Promise<TastingInvitee>;
  getTastingInvitees(tastingId: number): Promise<TastingInvitee[]>;
  removeTastingInvitee(tastingId: number, email: string): Promise<boolean>;
  
  // Scoring Rules
  createScoringRule(rule: Omit<InsertScoringRule, 'id'>): Promise<ScoringRule>;
  getScoringRule(tastingId: number): Promise<ScoringRule | undefined>;
  
  // Flight methods
  createFlight(flight: {
    tastingId: number;
    name: string;
    orderIndex: number;
    timeLimit: number;
  }): Promise<Flight>;
  getFlightsByTasting(tastingId: number): Promise<Flight[]>;
  updateFlightTimes(id: number, startedAt?: Date, completedAt?: Date): Promise<Flight>;
  
  // Wine methods
  createWine(wine: Omit<InsertWine, 'id'> & { vinaturelId?: string | null }): Promise<Wine>;
  getWinesByFlight(flightId: number): Promise<Wine[]>;
  getWineById(id: number): Promise<Wine | undefined>;
  searchWines(query: string, limit?: number): Promise<Wine[]>;
  
  // Participant methods
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  getParticipantsByTasting(tastingId: number | string): Promise<Participant[]>;
  getParticipant(tastingId: number | string, userId: number | string): Promise<Participant | undefined>;
  removeParticipant(tastingId: number | string, userId: number | string): Promise<boolean>;
  updateParticipantScore(id: number, score: number): Promise<Participant>;
  
  // Guess methods
  createGuess(guess: Omit<InsertGuess, 'id'> & {
    name?: string | null,
    country?: string | null,
    // ... andere optionale Felder
  }): Promise<Guess>;
  getGuessesByParticipant(participantId: number): Promise<Guess[]>;
  getGuessByWine(participantId: number, wineId: number): Promise<Guess | undefined>;
  updateGuessScore(id: number, score: number): Promise<Guess>;
  
  // Session store
  sessionStore: any; // Wir verwenden any statt session.SessionStore für Typsicherheit
}

export class MemStorage implements IStorage {
  private userIdCounter = 1;
  private users = new Map<number, User>();
  
  private tastingIdCounter = 1;
  private tastings = new Map<number, Tasting>();
  
  private tastingInvitees: Array<{
    tastingId: number;
    email: string;
    role: string;
  }> = [];

  private tastingInviteeIdCounter = 1;

  private scoringRuleIdCounter: number = 1;
  private scoringRules: Map<number, ScoringRule>;

  private flightIdCounter: number = 1;
  private flights: Map<number, Flight>;

  private wineIdCounter: number = 1;
  private wines: Map<number, Wine>;

  private participantIdCounter: number = 1;
  private participants: Map<number, Participant>;

  private guessIdCounter: number = 1;
  private guesses: Map<number, Guess>;

  sessionStore: any;
  
  constructor() {
    console.log('Current storage implementation:', this.constructor.name);
    
    this.scoringRules = new Map();
    this.flights = new Map();
    this.wines = new Map();
    this.participants = new Map();
    this.guesses = new Map();
    
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Clear expired sessions every 24h
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    return Array.from(this.users.values()).find(
      (user) => user.email === normalized
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const createdAt = new Date();
    const user: User = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error('User not found');
    
    const updatedUser = {
      ...existing,
      ...user,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Tasting methods
  async createTasting(data: {
    name: string;
    hostId: number;
    isPublic: boolean;
    password?: string;
    invitedEmails?: string[];
  }): Promise<Tasting> {
    const id = this.tastingIdCounter++;
    const createdAt = new Date();
    const tasting: Tasting = { 
      ...data, 
      id, 
      createdAt, 
      completedAt: null,
      status: "draft",
      password: data.password || null,
      isPublic: data.isPublic || false
    };
    this.tastings.set(id, tasting);

    if (data.invitedEmails?.length) {
      const validEmails = data.invitedEmails
        .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        .map(email => email.trim().toLowerCase());

      if (validEmails.length) {
        this.tastingInvitees.push(...validEmails.map(email => ({
          tastingId: id,
          email,
          role: 'guest'
        })));
      }
    }

    return tasting;
  }

  async getTasting(id: number): Promise<Tasting | undefined> {
    return this.tastings.get(id);
  }

  async getAllTastings(): Promise<Tasting[]> {
    return Array.from(this.tastings.values());
  }

  async getPublicTastings(): Promise<Tasting[]> {
    return Array.from(this.tastings.values())
      .filter(t => t.isPublic);
  }

  async getUserTastings(userId: number, userEmail: string): Promise<{
    hosted: TastingWithHost[];
    participating: TastingWithHost[];
    available: TastingWithHost[];
    invited: TastingWithHost[];
  }> {
    return {
      hosted: await this.getHostedTastings(userId),
      participating: [],
      available: [],
      invited: []
    };
  }

  async getHostedTastings(hostId: number): Promise<TastingWithHost[]> {
    return Array.from(this.tastings.values())
      .filter(t => t.hostId === hostId)
      .map(t => ({
        ...t,
        hostName: '',
        hostCompany: null
      }));
  }

  async updateTasting(id: number, update: Partial<Tasting>): Promise<Tasting> {
    const tasting = this.tastings.get(id);
    if (!tasting) throw new Error('Tasting not found');
    
    const updatedTasting = { ...tasting, ...update };
    this.tastings.set(id, updatedTasting);
    return updatedTasting;
  }

  async updateTastingStatus(id: number, status: string): Promise<Tasting> {
    const tasting = this.tastings.get(id);
    if (!tasting) throw new Error('Tasting not found');
    
    const updatedTasting = { ...tasting, status };
    this.tastings.set(id, updatedTasting);
    return updatedTasting;
  }

  async deleteTasting(id: number): Promise<void> {
    // 1. Zuerst die Weine löschen (die mit Flights verknüpft sind)
    this.wines.forEach((wine, wineId) => {
      if (wine.flightId) {
        const flight = this.flights.get(wine.flightId);
        if (flight && flight.tastingId === id) {
          this.wines.delete(wineId);
        }
      }
    });
    
    // 2. Dann die Flights löschen
    this.flights.forEach((flight, flightId) => {
      if (flight.tastingId === id) {
        this.flights.delete(flightId);
      }
    });
    
    // 3. Dann die Verkostung löschen
    this.tastings.delete(id);
  }

  async addTastingInvitee(invitee: InsertTastingInvitee & { role: string }): Promise<TastingInvitee> {
    const newInvitee = {
      ...invitee,
      id: this.tastingInviteeIdCounter++
    };
    this.tastingInvitees.push({
      tastingId: invitee.tastingId,
      email: invitee.email,
      role: invitee.role
    });
    return newInvitee;
  }

  async getTastingInvitees(tastingId: number): Promise<TastingInvitee[]> {
    return this.tastingInvitees.filter(i => i.tastingId === tastingId) as any;
  }

  async removeTastingInvitee(tastingId: number, email: string): Promise<boolean> {
    const before = this.tastingInvitees.length;
    this.tastingInvitees = this.tastingInvitees.filter(i => !(i.tastingId === tastingId && i.email === email));
    return this.tastingInvitees.length < before;
  }

  // Scoring Rules
  async createScoringRule(rule: Omit<InsertScoringRule, 'id'>): Promise<ScoringRule> {
    const fullRule: InsertScoringRule = {
      ...rule,
      country: rule.country ?? 0,
      region: rule.region ?? 0,
      // ... andere erforderliche Felder
    };
    const result = await db.insert(scoringRules).values(fullRule).returning();
    return result[0];
  }

  async getScoringRule(tastingId: number): Promise<ScoringRule | undefined> {
    const result = await db
      .select()
      .from(scoringRules)
      .where(eq(scoringRules.tastingId, tastingId));
    return result[0];
  }

  // Flight methods
  async createFlight(flightData: {
    tastingId: number;
    name: string;
    orderIndex: number;
    timeLimit: number;
  }): Promise<Flight> {
    try {
      // Fallback zu direktem pg-Pool
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query(`
        INSERT INTO flights 
        (tasting_id, name, order_index, time_limit, started_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, tasting_id as "tastingId", 
                  order_index as "orderIndex", time_limit as "timeLimit",
                  started_at as "startedAt", completed_at as "completedAt"
      `, [
        flightData.tastingId,
        flightData.name,
        flightData.orderIndex,
        flightData.timeLimit,
        null,
        null
      ]);
      await pool.end();
      return result.rows[0];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      
      console.error('Database error details:', {
        error: errorMessage,
        stack: errorStack,
        config: process.env.DATABASE_URL
      });
      
      throw new Error(`Failed to create flight: ${errorMessage}`);
    }
  }

  async getFlightsByTasting(tastingId: number): Promise<Flight[]> {
    try {
      console.log('Executing getFlightsByTasting for tastingId:', tastingId);
      const sql = `SELECT id, name, tasting_id as "tastingId", order_index as "orderIndex", 
                   time_limit as "timeLimit", started_at as "startedAt", completed_at as "completedAt" 
                   FROM flights WHERE tasting_id = $1 ORDER BY order_index`;
      console.log('SQL Query:', sql);
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const { rows } = await pool.query(sql, [tastingId]);
      await pool.end();
      return rows;
    } catch (error) {
      console.error('Database error in getFlightsByTasting:', error);
      throw error;
    }
  }

  async updateFlightTimes(id: number, startedAt?: Date, completedAt?: Date): Promise<Flight> {
    try {
      console.log(`updateFlightTimes called with id: ${id}, startedAt: ${startedAt}, completedAt: ${completedAt}`);
      
      // Überprüfe, ob der Flight existiert
      const flightResult = await db
        .select()
        .from(flights)
        .where(eq(flights.id, id))
        .limit(1);
      
      if (flightResult.length === 0) {
        throw new Error(`Flight with id ${id} not found`);
      }
      
      // Erstelle ein Update-Objekt nur mit den übergebenen Werten
      const updateValues: { startedAt?: Date; completedAt?: Date } = {};
      
      if (startedAt !== undefined) {
        updateValues.startedAt = startedAt;
      }
      
      if (completedAt !== undefined) {
        updateValues.completedAt = completedAt;
      }
      
      // Führe das Update durch
      const result = await db
        .update(flights)
        .set(updateValues)
        .where(eq(flights.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error('Failed to update flight times');
      }
      
      return result[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in updateFlightTimes:', errorMessage, error);
      throw new Error(`Failed to update flight times: ${errorMessage}`);
    }
  }

  // Wine methods
  async createWine(wineData: Omit<InsertWine, 'id' | 'vinaturelId' | 'isCustom' | 'imageUrl'> & { 
    vinaturelId?: string | null, 
    isCustom?: boolean,
    imageUrl?: string | null 
  }): Promise<Wine> {
    const fullWine: Omit<InsertWine, 'id'> = {
      name: wineData.name,
      country: wineData.country,
      region: wineData.region,
      producer: wineData.producer,
      vintage: wineData.vintage,
      varietals: wineData.varietals,
      flightId: wineData.flightId,
      letterCode: wineData.letterCode,
      vinaturelId: wineData.vinaturelId ?? null,
      isCustom: wineData.isCustom ?? false,
      imageUrl: wineData.imageUrl ?? null
    };
    const result = await db.insert(wines).values(fullWine).returning();
    return result[0];
  }

  async getWinesByFlight(flightId: number): Promise<Wine[]> {
    console.log('[getWinesByFlight] Using DB:', process.env.DATABASE_URL);
    console.log('[getWinesByFlight] Querying for flightId:', flightId);
    const result = await db
      .select()
      .from(wines)
      .where(eq(wines.flightId, flightId))
      .orderBy(wines.letterCode);
    console.log('[getWinesByFlight] Result:', result);
    return result;
  }

  async getWineById(id: number): Promise<Wine | undefined> {
    const result = await db.select().from(wines).where(eq(wines.id, id));
    return result[0];
  }

  async searchWines(query: string, limit = 20): Promise<Wine[]> {
    return db
      .select()
      .from(wines)
      .where(
        or(
          ilike(wines.name, `%${query}%`),
          ilike(wines.producer, `%${query}%`),
          ilike(wines.region, `%${query}%`),
          ilike(wines.vintage, `%${query}%`)
        )
      )
      .limit(limit);
  }

  // Participant methods
  async createParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    // Check if participant already exists
    const existingParticipant = await this.getParticipant(
      insertParticipant.tastingId, 
      insertParticipant.userId
    );
    
    if (existingParticipant) {
      return existingParticipant;
    }
    
    try {
      // Get user to get the name
      const user = await this.getUser(insertParticipant.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Ensure name is set, fallback to 'Anonymous' if not provided
      const participantName = insertParticipant.name || user.name || 'Anonymous';
      
      const [newParticipant] = await db
        .insert(participants)
        .values({
          tastingId: insertParticipant.tastingId,
          userId: insertParticipant.userId,
          name: participantName,
          joinedAt: new Date(),
          score: 0
        })
        .returning();
      
      return newParticipant;
    } catch (error) {
      console.error('Error creating participant:', error);
      throw new Error('Failed to create participant');
    }
  }

  async getParticipantsByTasting(tastingId: number | string): Promise<Array<Participant & { user: User, isHost: boolean }>> {
    try {
      // Konvertiere die ID in eine Zahl, falls sie als String übergeben wurde
      const parsedTastingId = typeof tastingId === 'string' ? parseInt(tastingId, 10) : tastingId;

      // Validiere die Eingabeparameter
      if (isNaN(parsedTastingId)) {
        console.error('Ungültige Tasting-ID in getParticipantsByTasting:', { tastingId, parsedTastingId });
        return [];
      }

      // Zuerst die Verkostung abrufen, um den Host zu identifizieren
      const tasting = await this.getTasting(parsedTastingId);
      if (!tasting) {
        console.error('Verkostung nicht gefunden:', parsedTastingId);
        return [];
      }
      const hostId = tasting.hostId;

      // Hole alle Teilnehmer mit ihren Benutzerdaten
      const results = await db
        .select({
          participant: participants,
          user: {
            id: users.id,
            email: users.email,
            name: users.name,
            company: users.company,
            profileImage: users.profileImage,
            createdAt: users.createdAt
          }
        })
        .from(participants)
        .innerJoin(users, eq(participants.userId, users.id))
        .where(eq(participants.tastingId, parsedTastingId))
        .orderBy(desc(participants.score));

      return results.map(row => ({
        ...row.participant,
        user: row.user as User,
        isHost: row.user.id === hostId
      }));
    } catch (error) {
      console.error('Fehler beim Abrufen der Teilnehmer:', error);
      return [];
    }
  }

  async getParticipant(tastingId: number | string, userId: number | string): Promise<Participant | undefined> {
    try {
      // Konvertiere die IDs in Zahlen, falls sie als Strings übergeben wurden
      const parsedTastingId = typeof tastingId === 'string' ? parseInt(tastingId, 10) : tastingId;
      const parsedUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

      // Validiere die Eingabeparameter
      if (isNaN(parsedTastingId) || isNaN(parsedUserId)) {
        console.error('Ungültige Parameter in getParticipant:', { 
          tastingId, 
          userId,
          parsedTastingId,
          parsedUserId,
          typeTastingId: typeof tastingId,
          typeUserId: typeof userId
        });
        return undefined;
      }

      const result = await db
        .select()
        .from(participants)
        .where(
          and(
            eq(participants.tastingId, parsedTastingId),
            eq(participants.userId, parsedUserId)
        ));
      
      return result[0];
    } catch (error) {
      console.error('Fehler beim Abrufen des Teilnehmers:', error);
      return undefined;
    }
  }

  async removeParticipant(tastingId: number | string, userId: number | string): Promise<boolean> {
    console.log('removeParticipant called with:', { tastingId, userId, typeTastingId: typeof tastingId, typeUserId: typeof userId });
    
    try {
      // Konvertiere die IDs in Zahlen, falls sie als Strings übergeben wurden
      const parsedTastingId = typeof tastingId === 'string' ? parseInt(tastingId, 10) : tastingId;
      const parsedUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

      // Validiere die Eingabeparameter
      if (isNaN(parsedTastingId) || isNaN(parsedUserId)) {
        const errorMessage = 'Ungültige Parameter in removeParticipant';
        console.error(errorMessage, { 
          tastingId, 
          userId,
          parsedTastingId,
          parsedUserId,
          typeTastingId: typeof tastingId,
          typeUserId: typeof userId
        });
        throw new Error(errorMessage);
      }

      // Log vor dem Abrufen des Teilnehmers
      console.log('Suche nach Teilnehmer:', { parsedTastingId, parsedUserId });
      
      // Hole den Teilnehmer vor dem Löschen
      const participant = await this.getParticipant(parsedTastingId, parsedUserId);
      
      if (!participant) {
        const errorMessage = 'Teilnehmer nicht gefunden';
        console.error(errorMessage, { parsedTastingId, parsedUserId });
        throw new Error(errorMessage);
      }
      
      // Log vor dem Löschen
      console.log('Lösche Teilnehmer:', { parsedTastingId, parsedUserId });
      
      // Lösche den Teilnehmer
      const result = await db
        .delete(participants)
        .where(
          and(
            eq(participants.tastingId, parsedTastingId),
            eq(participants.userId, parsedUserId)
          )
        )
        .returning();
        
      const wasRemoved = result.length > 0;
      
      if (wasRemoved) {
        console.log('Teilnehmer erfolgreich entfernt:', { parsedTastingId, parsedUserId });
      } else {
        console.error('Teilnehmer konnte nicht entfernt werden:', { parsedTastingId, parsedUserId });
      }
      
      return wasRemoved;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error('Fehler beim Entfernen des Teilnehmers:', errorMessage, error);
      throw new Error(`Fehler beim Entfernen des Teilnehmers: ${errorMessage}`);
    }
  }

  async updateParticipantScore(id: number, score: number): Promise<Participant> {
    const result = await db
      .update(participants)
      .set({ score })
      .where(eq(participants.id, id))
      .returning();
    
    return result[0];
  }

  // Guess methods
  async createGuess(insertGuess: Omit<InsertGuess, 'id'> & {
    name?: string | null,
    country?: string | null,
    region?: string | null,
    producer?: string | null,
    vintage?: string | null,
    varietals?: string[],
    rating?: number | null,
    notes?: string | null
  }): Promise<Guess> {
    // Check if a guess already exists for this participant and wine
    const existingGuess = await this.getGuessByWine(
      insertGuess.participantId,
      insertGuess.wineId
    );
    
    // If exists, update it
    if (existingGuess) {
      const result = await db
        .update(guesses)
        .set({
          ...insertGuess,
          name: insertGuess.name ?? existingGuess.name,
          country: insertGuess.country ?? existingGuess.country,
          region: insertGuess.region ?? existingGuess.region,
          producer: insertGuess.producer ?? existingGuess.producer,
          vintage: insertGuess.vintage ?? existingGuess.vintage,
          varietals: insertGuess.varietals ?? existingGuess.varietals,
          rating: insertGuess.rating ?? existingGuess.rating,
          notes: insertGuess.notes ?? existingGuess.notes,
          submittedAt: new Date()
        })
        .where(eq(guesses.id, existingGuess.id))
        .returning();
      
      return result[0];
    }
    
    // Otherwise create new
    const result = await db.insert(guesses).values({
      ...insertGuess,
      name: insertGuess.name ?? null,
      country: insertGuess.country ?? null,
      region: insertGuess.region ?? null,
      producer: insertGuess.producer ?? null,
      vintage: insertGuess.vintage ?? null,
      varietals: insertGuess.varietals ?? [],
      rating: insertGuess.rating ?? null,
      notes: insertGuess.notes ?? null,
      score: 0,
      submittedAt: new Date()
    }).returning();
    
    return result[0];
  }

  async getGuessesByParticipant(participantId: number): Promise<Guess[]> {
    return await db
      .select()
      .from(guesses)
      .where(eq(guesses.participantId, participantId));
  }

  async getGuessByWine(participantId: number, wineId: number): Promise<Guess | undefined> {
    const result = await db
      .select()
      .from(guesses)
      .where(
        and(
          eq(guesses.participantId, participantId),
          eq(guesses.wineId, wineId)
        )
      );
    
    return result[0];
  }

  async updateGuessScore(id: number, score: number): Promise<Guess> {
    const result = await db
      .update(guesses)
      .set({ score })
      .where(eq(guesses.id, id))
      .returning();
    
    return result[0];
  }

  async getParticipatingTastings(userId: number): Promise<TastingWithHost[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    try {
      const inviteeRows = await db.execute<{ tastingId: number }>(sql`SELECT tasting_id as "tastingId" FROM tasting_invitees WHERE email = ${user.email}`);
      const ids = inviteeRows.rows.map(r => r.tastingId);
      if (ids.length === 0) return [];
      const tastingRows = await db
        .select()
        .from(tastings)
        .where(inArray(tastings.id, ids));
      return tastingRows.map(t => ({
        ...t,
        hostName: 'Unbekannter Benutzer',
        hostCompany: null,
        requiresPassword: !!t.password
      }));
    } catch (e) {
      return [];
    }
  }

  async getAvailableTastings(userId: number): Promise<TastingWithHost[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    const participatingIds = (await this.getParticipatingTastings(userId)).map(t => t.id);
    const hostedIds = (await this.getHostedTastings(userId)).map(t => t.id);
    try {
      const rows = await db
        .select()
        .from(tastings)
        .where(and(
          or(eq(tastings.isPublic, true), sql`${tastings.password} IS NOT NULL`),
          ne(tastings.hostId, userId)
        ));
      return rows
        .filter(t => !participatingIds.includes(t.id) && !hostedIds.includes(t.id))
        .map(t => ({
          ...t,
          hostName: 'Unbekannter Benutzer',
          hostCompany: null,
          requiresPassword: !!t.password
        }));
    } catch (e) {
      return [];
    }
  }

  async getInvitedTastings(userId: number): Promise<TastingWithHost[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    try {
      const inviteeRows2 = await db.execute<{ tastingId: number }>(sql`SELECT tasting_id as "tastingId" FROM tasting_invitees WHERE email = ${user.email}`);
      const ids = inviteeRows2.rows.map(r => r.tastingId);
      if (ids.length === 0) return [];
      const tastingRows = await db
        .select()
        .from(tastings)
        .where(inArray(tastings.id, ids));
      return tastingRows.map(t => ({
        ...t,
        hostName: 'Unbekannter Benutzer',
        hostCompany: null,
        requiresPassword: !!t.password
      }));
    } catch (e) {
      return [];
    }
  }
}

// DatabaseStorage Implementierung
export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    console.log('Current storage implementation:', this.constructor.name);
    const PostgresSessionStore = connectPgSimple(session);
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true
    });
  }

  

  // User methods
  async getUser(id: number | string): Promise<User | undefined> {
    try {
      // Konvertiere die ID in eine Zahl, falls sie als String übergeben wurde
      const parsedId = typeof id === 'string' ? parseInt(id, 10) : id;

      // Validiere die Eingabeparameter
      if (isNaN(parsedId)) {
        console.error('Ungültige Benutzer-ID in getUser:', { id, parsedId });
        return undefined;
      }

      // Hole den Benutzer mit allen benötigten Feldern
      const result = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          password: users.password,
          company: users.company,
          profileImage: users.profileImage,
          createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.id, parsedId));
      
      return result[0];
    } catch (error) {
      console.error(`Fehler beim Abrufen des Benutzers mit der ID ${id}:`, error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    const result = await db.select().from(users).where(eq(users.email, normalized));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const userWithDefaults = {
      ...insertUser,
      profileImage: insertUser.profileImage || '' // Setze einen leeren String als Standardwert
    };
    const result = await db.insert(users).values(userWithDefaults).returning();
    return result[0];
  }

  // Tasting methods
  async createTasting(data: {
    name: string;
    hostId: number;
    isPublic: boolean;
    password?: string;
    invitedEmails?: string[];
  }): Promise<Tasting> {
    if (!db) {
      throw new Error('Database connection not initialized');
    }
    
    try {
      const result = await db
        .insert(tastings)
        .values({
          name: data.name,
          hostId: data.hostId,
          isPublic: data.isPublic,
          password: data.password || null,
          status: 'draft',
          createdAt: new Date(),
          completedAt: null
        })
        .returning();
      
      if (!result[0]) {
        throw new Error('Failed to create tasting');
      }
      
      const tasting = result[0];
      
      // Add invitees if provided
      if (data.invitedEmails && data.invitedEmails.length > 0) {
        for (const email of data.invitedEmails) {
          await this.addTastingInvitee({
            email,
            tastingId: tasting.id,
            role: 'guest'
          });
        }
      }
      
      return tasting;
    } catch (error) {
      console.error('Error creating tasting:', error);
      throw new Error(`Failed to create tasting: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTasting(id: number | string): Promise<(Tasting & { hostName: string; hostCompany: string | null }) | undefined> {
    try {
      // Konvertiere die ID in eine Zahl, falls sie als String übergeben wurde
      const parsedId = typeof id === 'string' ? parseInt(id, 10) : id;

      // Validiere die Eingabeparameter
      if (isNaN(parsedId)) {
        console.error('Ungültige Tasting-ID in getTasting:', { id, parsedId });
        return undefined;
      }

      // Hole die Verkostung
      const result = await db.select().from(tastings).where(eq(tastings.id, parsedId));
      const tasting = result[0];
      
      if (!tasting) {
        console.error('Verkostung nicht gefunden:', parsedId);
        return undefined;
      }
      
      // Hole die Host-Informationen
      const host = await this.getUser(tasting.hostId);
      
      if (!host) {
        console.error('Host nicht gefunden für Verkostung:', { tastingId: parsedId, hostId: tasting.hostId });
        return undefined;
      }
      
      // Gebe die Verkostung mit Host-Informationen zurück
      return {
        ...tasting,
        hostName: host.name || 'Unbekannt',
        hostCompany: host.company || null
      };
    } catch (error) {
      console.error('Fehler in getTasting:', error);
      return undefined;
    }
  }

  async getAllTastings(): Promise<Tasting[]> {
    try {
      console.log('[getAllTastings] Starting query');
      const results = await db
        .select({
          id: tastings.id,
          name: tastings.name,
          hostId: tastings.hostId,
          isPublic: tastings.isPublic,
          password: tastings.password,
          createdAt: tastings.createdAt,
          completedAt: tastings.completedAt,
          status: tastings.status,
          requiresPassword: sql<boolean>`${tastings.password} IS NOT NULL`,
          hostName: users.name,
          hostCompany: users.company
        })
        .from(tastings)
        .leftJoin(users, eq(users.id, tastings.hostId));

      console.log('[getAllTastings] Query results:', results);
      
      const mappedResults = results.map(t => ({
        ...t,
        requiresPassword: !!t.password,
        hostName: t.hostName || null,
        hostCompany: t.hostCompany || null
      }));

      console.log('[getAllTastings] Mapped results:', mappedResults);
      return mappedResults;
    } catch (error) {
      console.error('[getAllTastings] Error:', error);
      return [];
    }
  }

  async getPublicTastings(): Promise<Array<Tasting & { hostName: string | null; hostCompany: string | null }>> {
    type TastingRow = {
      id: number;
      name: string;
      hostId: number;
      isPublic: boolean;
      password: string | null;
      createdAt: Date;
      completedAt: Date | null;
      status: string;
      requiresPassword?: boolean;
    };

    try {
      // First get all public tastings
      const publicTastings: TastingRow[] = [];
      const publicTastingsResult = await db
        .select({
          id: tastings.id,
          name: tastings.name,
          hostId: tastings.hostId,
          isPublic: tastings.isPublic,
          password: tastings.password,
          createdAt: tastings.createdAt,
          completedAt: tastings.completedAt,
          status: tastings.status,
          requiresPassword: sql<boolean>`${tastings.password} IS NOT NULL`
        })
        .from(tastings)
        .where(
          and(
            eq(tastings.isPublic, true),
            ne(tastings.status, "draft") // Exclude draft tastings
          )
        ) as unknown as TastingRow[];
      
      if (!publicTastingsResult || publicTastingsResult.length === 0) {
        return [];
      }
      
      // Get unique host IDs
      const hostIds = Array.from(new Set(publicTastingsResult.map((t: TastingRow) => t.hostId)));
      
      // Get all host users in a single query
      let hostUsers: Array<{
        id: number;
        name: string | null;
        company: string | null;
        email: string | null;
      }> = [];
      
      try {
        console.log(`[getPublicTastings] Fetching host users for IDs:`, hostIds);
        
        hostUsers = await db
          .select({
            id: users.id,
            name: users.name,
            company: users.company,
            email: users.email
          })
          .from(users)
          .where(inArray(users.id, hostIds));
        
        console.log(`[getPublicTastings] Successfully fetched ${hostUsers.length} host users`);
      } catch (error) {
        console.error('[getPublicTastings] Error fetching host users:', error);
        throw new Error('Failed to fetch host users');
      }
      
      // Create a map of hostId to user
      const hostMap = new Map(hostUsers.map(user => [user.id, user]));
      
      // Add host information to each tasting
      return publicTastingsResult.map((tasting: TastingRow) => {
        const hostUser = hostMap.get(tasting.hostId);
        return {
          ...tasting,
          hostName: hostUser?.name || 'Unbekannt',
          hostCompany: hostUser?.company || ''
        } as Tasting & { hostName: string | null; hostCompany: string | null };
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in getPublicTastings:', errorMessage);
      return [];
    }
  }

  private hostInfoCache = new Map<number, { name: string; company: string | null; email: string | null }>();



  async getUserTastings(userId: number, userEmail: string): Promise<{
    hosted: TastingWithHost[];
    participating: TastingWithHost[];
    available: TastingWithHost[];
    invited: TastingWithHost[];
  }> {
    console.log(`[getUserTastings] Starting for user ID: ${userId}`);
    
    type TastingRow = {
      id: number;
      name: string;
      hostId: number;
      isPublic: boolean;
      password: string | null;
      createdAt: Date;
      completedAt: Date | null;
      status: string;
      requiresPassword?: boolean;
    };
    
    interface TastingWithHost extends Tasting {
      hostName: string;
      hostCompany: string | null;
      requiresPassword?: boolean;
    }
    
    interface HostInfo {
      name: string;
      company: string | null;
      email: string | null;
    }
    
    console.log('[getUserTastings] Type definitions initialized');

    try {
      // Get user data for invitation check
      console.log('[getUserTastings] Fetching user data for ID:', userId);
      const user = await this.getUser(userId);
      if (!user) {
        console.error(`[getUserTastings] User with ID ${userId} not found`);
        return { hosted: [], participating: [], available: [], invited: [] };
      }
      console.log('[getUserTastings] User data retrieved:', { id: user.id, email: user.email, name: user.name });

      // 1. Get tastings where user is the host
      const hostedTastings: TastingWithHost[] = [];
      // First, let's get all tastings where the user is the host
      const hostedTastingsResult = await db
        .select({
          id: tastings.id,
          name: tastings.name,
          createdAt: tastings.createdAt,
          status: tastings.status,
          hostId: tastings.hostId,
          isPublic: tastings.isPublic,
          completedAt: tastings.completedAt,
          tastingPassword: tastings.password, // Renamed to avoid ambiguity
          requiresPassword: sql<boolean>`${tastings.password} IS NOT NULL`,
          hostName: users.name,
          hostCompany: users.company,
        })
        .from(tastings)
        .leftJoin(users, eq(users.id, tastings.hostId))
        .where(eq(tastings.hostId, userId));

      hostedTastings.push(...hostedTastingsResult.map(t => {
        // Use the renamed field and handle potential undefined
        const requiresPassword = !!(t as any).tastingPassword;
        return {
          ...t,
          hostName: (t.hostName || '').trim(),
          hostCompany: t.hostCompany || null,
          requiresPassword,
          password: (t as any).tastingPassword // Keep backward compatibility
        };
      }));

      // 2. Get tastings where user is invited
      const inviteResults = await db.execute<{ tastingId: number }>(sql`SELECT tasting_id as "tastingId" FROM tasting_invitees WHERE email = ${userEmail}`);

      const inviteeTastingIds = inviteResults.rows.map(t => t.tastingId);

      let invitedTastings: TastingWithHost[] = [];
      if (inviteeTastingIds.length > 0) {
        const invitedTastingsResult = await db
          .select({
            id: tastings.id,
            name: tastings.name,
            hostId: tastings.hostId,
            isPublic: tastings.isPublic,
            tastingPassword: tastings.password, // Renamed to avoid ambiguity
            createdAt: tastings.createdAt,
            completedAt: tastings.completedAt,
            status: tastings.status,
            requiresPassword: sql<boolean>`${tastings.password} IS NOT NULL`,
            hostName: users.name,
            hostCompany: users.company,
          })
          .from(tastings)
          .leftJoin(users, eq(users.id, tastings.hostId))
          .where(inArray(tastings.id, inviteeTastingIds));
        
        invitedTastings.push(...invitedTastingsResult.map(t => {
          const requiresPassword = !!(t as any).tastingPassword;
          return {
            ...t,
            hostName: (t.hostName || '').trim(),
            hostCompany: t.hostCompany || null,
            requiresPassword,
            password: (t as any).tastingPassword // Keep backward compatibility
          };
        }));
      }

      // 3. Get public and password-protected tastings where user is not the host
      const publicTastings: TastingWithHost[] = [];
      const publicTastingsResult = await db
        .select({
          id: tastings.id,
          name: tastings.name,
          hostId: tastings.hostId,
          isPublic: tastings.isPublic,
          tastingPassword: tastings.password, // Renamed to avoid ambiguity
          createdAt: tastings.createdAt,
          completedAt: tastings.completedAt,
          status: tastings.status,
          requiresPassword: sql<boolean>`${tastings.password} IS NOT NULL`,
          hostName: users.name,
          hostCompany: users.company,
        })
        .from(tastings)
        .leftJoin(users, eq(users.id, tastings.hostId))
        .where(and(
          or(
            eq(tastings.isPublic, true),
            sql`${tastings.password} IS NOT NULL` // Fixed ambiguous column reference
          ),
          sql`${tastings.status} IN ('active','started')`,
          ne(tastings.hostId, userId)
        ));
      
      publicTastings.push(...publicTastingsResult.map(t => {
        const requiresPassword = !!(t as any).tastingPassword;
        return {
          ...t,
          hostName: (t.hostName || '').trim(),
          hostCompany: t.hostCompany || null,
          requiresPassword,
          password: (t as any).tastingPassword // Keep backward compatibility
        };
      }));

      // The requiresPassword field is already set in the query

      // Combine all tastings and remove duplicates
      const allTastings = [...hostedTastings, ...invitedTastings, ...publicTastings];
      const uniqueTastings = Array.from(new Map(allTastings.map(t => [t.id, t])).values());

      // Get all unique host IDs
      const allHostIds = [...new Set(uniqueTastings.map(t => t.hostId))];
      
      if (allHostIds.length === 0) {
        console.log('[getUserTastings] No host IDs found, returning empty result');
        return { hosted: [], participating: [], available: [], invited: [] };
      }
      
      // Get all host users in a single query with proper error handling
      let hostUsers: Array<{
        id: number;
        name: string | null;
        company: string | null;
        email: string | null;
      }> = [];
      
      try {
        console.log(`[getUserTastings] Fetching host users for IDs:`, allHostIds);
        
        hostUsers = await db
          .select({
            id: users.id,
            name: users.name,
            company: users.company,
            email: users.email
          })
          .from(users)
          .where(inArray(users.id, allHostIds));
        
        console.log(`[getUserTastings] Successfully fetched ${hostUsers.length} host users`);
      } catch (error) {
        console.error('[getUserTastings] Error fetching host users:', error);
        throw new Error('Failed to fetch host users');
      }
      
      // Create a properly typed map of hostId to user info
      const hostMap = new Map<number, HostInfo>();
      
      // Populate the map with host information
      for (const host of hostUsers) {
        const hostInfo: HostInfo = {
          name: (host.name || '').trim() || 'Unbekannter Benutzer',
          company: host.company || null,
          email: host.email || null
        };
        console.log(`[getUserTastings] Adding to host map - ID: ${host.id}, Name: '${hostInfo.name}'`);
        hostMap.set(host.id, hostInfo);
      }

      // Process each tasting to add host information
      const tastingsWithHosts: TastingWithHost[] = [];
      
      for (const tasting of uniqueTastings) {
        console.log(`[getUserTastings] Processing tasting ${tasting.id}, hostId: ${tasting.hostId}`);
        
        // Initialize with default values
        let hostName = 'Unbekannter Benutzer';
        let hostCompany: string | null = null;
        
        try {
          // For the user's own tastings, use the current user's info
          if (tasting.hostId === userId) {
            hostName = (user.name || '').trim() || 'Unbekannter Benutzer';
            hostCompany = user.company || null;
            console.log(`[getUserTastings] Using current user as host for tasting ${tasting.id}: ${hostName}`);
          } else {
            // For other tastings, get host info from the map or fetch it
            console.log(`[getUserTastings] Looking up host ${tasting.hostId} in hostMap`);
            const hostInfo = hostMap.get(tasting.hostId);
            
            if (hostInfo) {
              hostName = hostInfo.name;
              hostCompany = hostInfo.company;
              console.log(`[getUserTastings] Found host info in map for tasting ${tasting.id}: ${hostName}`);
            } else {
              // If not in map, try to fetch from database
              console.warn(`[getUserTastings] No host info in map for tasting ${tasting.id} with hostId ${tasting.hostId}, fetching from database...`);
              try {
                const hostUser = await this.getUser(tasting.hostId);
                if (hostUser) {
                  hostName = (hostUser.name || '').trim() || 'Unbekannter Benutzer';
                  hostCompany = hostUser.company || null;
                  console.log(`[getUserTastings] Fetched host info directly for tasting ${tasting.id}: ${hostName}`);
                  
                  // Update the map for future use
                  this.hostInfoCache.set(tasting.hostId, {
                    name: hostName,
                    company: hostCompany,
                    email: hostUser.email || null
                  });
                } else {
                  console.warn(`[getUserTastings] No host found with ID ${tasting.hostId} for tasting ${tasting.id}`);
                }
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[getUserTastings] Error fetching host info for tasting ${tasting.id}:`, errorMessage);
              }  
            }
          }
          
          // Add the tasting with host information
          const tastingWithHost: TastingWithHost = {
            ...tasting,
            hostName: hostName,
            hostCompany: hostCompany,
            requiresPassword: !!tasting.password
          };
          
          tastingsWithHosts.push(tastingWithHost);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[getUserTastings] Error processing tasting ${tasting.id}:`, errorMessage);
          // Add the tasting without host information if there was an error
          tastingsWithHosts.push({
            ...tasting,
            hostName: 'Unbekannter Benutzer',
            hostCompany: null,
            requiresPassword: !!tasting.password
          });
        }
      }

      // Build result arrays preserving host info
      const hostedIds = new Set(hostedTastings.map(t => t.id));
      const invitedIds = new Set(invitedTastings.map(t => t.id));
      const publicIds  = new Set(publicTastings.map(t => t.id));

      const hostedOut = tastingsWithHosts.filter(t => hostedIds.has(t.id));
      const invitedOut = tastingsWithHosts.filter(t => invitedIds.has(t.id));
      const availableOut = tastingsWithHosts.filter(t => publicIds.has(t.id));

      return {
        hosted: hostedOut,
        participating: invitedOut, // historical naming kept
        available: availableOut,
        invited: invitedOut,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in getUserTastings:', errorMessage);
      return {
        hosted: [],
        participating: [],
        available: [],
        invited: [],
      };
    }
  }

  async getHostedTastings(hostId: number): Promise<Array<Tasting & { hostName: string; hostCompany: string | null }>> {
    console.log(`[getHostedTastings] Fetching tastings for host ID: ${hostId}`);
    
    try {
      // Get all tastings for the host
      const tastingsResult = await db
        .select({
          id: tastings.id,
          name: tastings.name,
          createdAt: tastings.createdAt,
          status: tastings.status,
          hostId: tastings.hostId,
          isPublic: tastings.isPublic,
          completedAt: tastings.completedAt,
          password: tastings.password,
          requiresPassword: sql<boolean>`${tastings.password} IS NOT NULL`
        })
        .from(tastings)
        .where(eq(tastings.hostId, hostId));
      
      console.log(`[getHostedTastings] Found ${tastingsResult.length} tastings for host ${hostId}`);
      
      if (!tastingsResult || tastingsResult.length === 0) {
        return [];
      }
      
      // Get the host information
      const host = await this.getUser(hostId);
      console.log(`[getHostedTastings] Fetched host info:`, { 
        hostId: host?.id, 
        name: host?.name, 
        company: host?.company 
      });
      
      if (!host) {
        console.error(`[getHostedTastings] Host with ID ${hostId} not found`);
      }
      
      // Return tastings with host information
      const result = tastingsResult.map(tasting => ({
        ...tasting,
        hostName: host?.name || 'Unbekannt',
        hostCompany: host?.company || null,
        requiresPassword: !!tasting.password
      }));
      
      console.log(`[getHostedTastings] Returning ${result.length} tastings with host info`);
      return result as Array<Tasting & { hostName: string; hostCompany: string | null }>;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[getHostedTastings] Error:', errorMessage, error);
      return [];
    }
  }

  async updateTasting(id: number, update: Partial<Tasting>): Promise<Tasting> {
    const tasting = await this.getTasting(id);
    if (!tasting) throw new Error('Tasting not found');
    
    const updatedTasting = { ...tasting, ...update };
    const result = await db
      .update(tastings)
      .set(updatedTasting)
      .where(eq(tastings.id, id))
      .returning();
    
    return result[0];
  }

  async updateTastingStatus(id: number, status: string): Promise<Tasting> {
    const updateValues: { status: string; password?: string | null } = { status };
    
    if (status === "completed") {
      updateValues.password = null;
    }
    
    const result = await db
      .update(tastings)
      .set(updateValues)
      .where(eq(tastings.id, id))
      .returning();
    
    return result[0];
  }

  async deleteTasting(id: number): Promise<void> {
    // 1. Zuerst die Weine löschen (die mit Flights verknüpft sind)
    await db.delete(wines)
      .where(
        inArray(
          wines.flightId, 
          db.select({id: flights.id})
            .from(flights)
            .where(eq(flights.tastingId, id))
        )
      );
      
    // 2. Dann die Flights löschen
    await db.delete(flights).where(eq(flights.tastingId, id));
    
    // 3. Dann die Verkostung löschen
    await db.delete(tastings).where(eq(tastings.id, id));
  }

  // Tasting Invitees
  async addTastingInvitee(invitee: InsertTastingInvitee & { role: string }): Promise<TastingInvitee> {
    try {
      await db.execute(sql`INSERT INTO tasting_invitees (tasting_id, email)
                           VALUES (${invitee.tastingId}, ${invitee.email})
                           ON CONFLICT (tasting_id, email) DO NOTHING`);
      return { tastingId: invitee.tastingId, email: invitee.email, role: invitee.role } as TastingInvitee;
    } catch (error) {
      return { tastingId: invitee.tastingId, email: invitee.email, role: invitee.role } as TastingInvitee;
    }
  }

  async getTastingInvitees(tastingId: number): Promise<TastingInvitee[]> {
    const res = await db.execute(sql`SELECT tasting_id as "tastingId", email FROM tasting_invitees WHERE tasting_id = ${tastingId}`);
    return (res.rows as any[]).map(r => ({ tastingId: r.tastingId, email: r.email, role: 'guest' }));
  }

  async removeTastingInvitee(tastingId: number, email: string): Promise<boolean> {
    const res = await db.execute(sql`DELETE FROM tasting_invitees WHERE tasting_id = ${tastingId} AND email = ${email}`);
    const rowCount = (res as any).rowCount ?? 0;
    return rowCount > 0;
  }

  // Scoring Rules
  async createScoringRule(rule: Omit<InsertScoringRule, 'id'>): Promise<ScoringRule> {
    const fullRule: InsertScoringRule = {
      ...rule,
      country: rule.country ?? 0,
      region: rule.region ?? 0,
      // ... andere erforderliche Felder
    };
    const result = await db.insert(scoringRules).values(fullRule).returning();
    return result[0];
  }

  async getScoringRule(tastingId: number): Promise<ScoringRule | undefined> {
    const result = await db
      .select()
      .from(scoringRules)
      .where(eq(scoringRules.tastingId, tastingId));
    return result[0];
  }

  // Flight methods
  async createFlight(flightData: {
    tastingId: number;
    name: string;
    orderIndex: number;
    timeLimit: number;
  }): Promise<Flight> {
    try {
      // Fallback zu direktem pg-Pool
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query(`
        INSERT INTO flights 
        (tasting_id, name, order_index, time_limit, started_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, tasting_id as "tastingId", 
                  order_index as "orderIndex", time_limit as "timeLimit",
                  started_at as "startedAt", completed_at as "completedAt"
      `, [
        flightData.tastingId,
        flightData.name,
        flightData.orderIndex,
        flightData.timeLimit,
        null,
        null
      ]);
      await pool.end();
      return result.rows[0];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      
      console.error('Database error details:', {
        error: errorMessage,
        stack: errorStack,
        config: process.env.DATABASE_URL
      });
      
      throw new Error(`Failed to create flight: ${errorMessage}`);
    }
  }

  async getFlightsByTasting(tastingId: number): Promise<Flight[]> {
    try {
      console.log('Executing getFlightsByTasting for tastingId:', tastingId);
      const sql = `SELECT id, name, tasting_id as "tastingId", order_index as "orderIndex", 
                   time_limit as "timeLimit", started_at as "startedAt", completed_at as "completedAt" 
                   FROM flights WHERE tasting_id = $1 ORDER BY order_index`;
      console.log('SQL Query:', sql);
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const { rows } = await pool.query(sql, [tastingId]);
      await pool.end();
      return rows;
    } catch (error) {
      console.error('Database error in getFlightsByTasting:', error);
      throw error;
    }
  }

  async updateFlightTimes(id: number, startedAt?: Date, completedAt?: Date): Promise<Flight> {
    try {
      console.log(`updateFlightTimes called with id: ${id}, startedAt: ${startedAt}, completedAt: ${completedAt}`);
      
      // Überprüfe, ob der Flight existiert
      const flightResult = await db
        .select()
        .from(flights)
        .where(eq(flights.id, id))
        .limit(1);
      
      if (flightResult.length === 0) {
        throw new Error(`Flight with id ${id} not found`);
      }
      
      // Erstelle ein Update-Objekt nur mit den übergebenen Werten
      const updateValues: { startedAt?: Date; completedAt?: Date } = {};
      
      if (startedAt !== undefined) {
        updateValues.startedAt = startedAt;
      }
      
      if (completedAt !== undefined) {
        updateValues.completedAt = completedAt;
      }
      
      // Führe das Update durch
      const result = await db
        .update(flights)
        .set(updateValues)
        .where(eq(flights.id, id))
        .returning();
      
      if (result.length === 0) {
        throw new Error('Failed to update flight times');
      }
      
      return result[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in updateFlightTimes:', errorMessage, error);
      throw new Error(`Failed to update flight times: ${errorMessage}`);
    }
  }

  // Wine methods
  async createWine(wine: Omit<InsertWine, 'id' | 'vinaturelId' | 'isCustom' | 'imageUrl'> & { 
    vinaturelId?: string | null, 
    isCustom?: boolean,
    imageUrl?: string | null 
  }): Promise<Wine> {
    const fullWine: Omit<InsertWine, 'id'> = {
      name: wine.name,
      country: wine.country,
      region: wine.region,
      producer: wine.producer,
      vintage: wine.vintage,
      varietals: wine.varietals,
      flightId: wine.flightId,
      letterCode: wine.letterCode,
      vinaturelId: wine.vinaturelId ?? null,
      isCustom: wine.isCustom ?? false,
      imageUrl: wine.imageUrl ?? null
    };
    const result = await db.insert(wines).values(fullWine).returning();
    return result[0];
  }

  async getWinesByFlight(flightId: number): Promise<Wine[]> {
    console.log('[getWinesByFlight] Using DB:', process.env.DATABASE_URL);
    console.log('[getWinesByFlight] Querying for flightId:', flightId);
    const result = await db
      .select()
      .from(wines)
      .where(eq(wines.flightId, flightId))
      .orderBy(wines.letterCode);
    console.log('[getWinesByFlight] Result:', result);
    return result;
  }

  async getWineById(id: number): Promise<Wine | undefined> {
    const result = await db.select().from(wines).where(eq(wines.id, id));
    return result[0];
  }

  async searchWines(query: string, limit = 20): Promise<Wine[]> {
    return db
      .select()
      .from(wines)
      .where(
        or(
          ilike(wines.name, `%${query}%`),
          ilike(wines.producer, `%${query}%`),
          ilike(wines.region, `%${query}%`),
          ilike(wines.vintage, `%${query}%`)
        )
      )
      .limit(limit);
  }

  // Participant methods
  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    // Check if participant already exists
    const existingParticipant = await this.getParticipant(
      participant.tastingId,
      participant.userId
    );
    
    if (existingParticipant) {
      return existingParticipant;
    }
    
    try {
      // Get user to get the name
      const user = await this.getUser(participant.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Ensure name is set, fallback to 'Anonymous' if not provided
      const participantName = participant.name || user.name || 'Anonymous';
      
      const [newParticipant] = await db
        .insert(participants)
        .values({
          tastingId: participant.tastingId,
          userId: participant.userId,
          name: participantName,
          joinedAt: new Date(),
          score: 0
        })
        .returning();
      
      return newParticipant;
    } catch (error) {
      console.error('Error creating participant:', error);
      throw new Error('Failed to create participant');
    }
  }

  async getParticipantsByTasting(tastingId: number | string): Promise<Array<Participant & { user: User, isHost: boolean }>> {
    try {
      // Konvertiere die ID in eine Zahl, falls sie als String übergeben wurde
      const parsedTastingId = typeof tastingId === 'string' ? parseInt(tastingId, 10) : tastingId;

      // Validiere die Eingabeparameter
      if (isNaN(parsedTastingId)) {
        console.error('Ungültige Tasting-ID in getParticipantsByTasting:', { tastingId, parsedTastingId });
        return [];
      }

      // Zuerst die Verkostung abrufen, um den Host zu identifizieren
      const tasting = await this.getTasting(parsedTastingId);
      if (!tasting) {
        console.error('Verkostung nicht gefunden:', parsedTastingId);
        return [];
      }
      const hostId = tasting.hostId;

      // Hole alle Teilnehmer mit ihren Benutzerdaten
      const results = await db
        .select({
          participant: participants,
          user: {
            id: users.id,
            email: users.email,
            name: users.name,
            company: users.company,
            profileImage: users.profileImage,
            createdAt: users.createdAt
          }
        })
        .from(participants)
        .innerJoin(users, eq(participants.userId, users.id))
        .where(eq(participants.tastingId, parsedTastingId))
        .orderBy(desc(participants.score));

      return results.map(row => ({
        ...row.participant,
        user: row.user as User,
        isHost: row.user.id === hostId
      }));
    } catch (error) {
      console.error('Fehler beim Abrufen der Teilnehmer:', error);
      return [];
    }
  }

  async getParticipant(tastingId: number | string, userId: number | string): Promise<Participant | undefined> {
    try {
      // Konvertiere die IDs in Zahlen, falls sie als Strings übergeben wurden
      const parsedTastingId = typeof tastingId === 'string' ? parseInt(tastingId, 10) : tastingId;
      const parsedUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

      // Validiere die Eingabeparameter
      if (isNaN(parsedTastingId) || isNaN(parsedUserId)) {
        console.error('Ungültige Parameter in getParticipant:', { 
          tastingId, 
          userId,
          parsedTastingId,
          parsedUserId,
          typeTastingId: typeof tastingId,
          typeUserId: typeof userId
        });
        return undefined;
      }

      const result = await db
        .select()
        .from(participants)
        .where(
          and(
            eq(participants.tastingId, parsedTastingId),
            eq(participants.userId, parsedUserId)
        ));
      
      return result[0];
    } catch (error) {
      console.error('Fehler beim Abrufen des Teilnehmers:', error);
      return undefined;
    }
  }

  async removeParticipant(tastingId: number | string, userId: number | string): Promise<boolean> {
    console.log('removeParticipant called with:', { tastingId, userId, typeTastingId: typeof tastingId, typeUserId: typeof userId });
    
    try {
      // Konvertiere die IDs in Zahlen, falls sie als Strings übergeben wurden
      const parsedTastingId = typeof tastingId === 'string' ? parseInt(tastingId, 10) : tastingId;
      const parsedUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

      // Validiere die Eingabeparameter
      if (isNaN(parsedTastingId) || isNaN(parsedUserId)) {
        const errorMessage = 'Ungültige Parameter in removeParticipant';
        console.error(errorMessage, { 
          tastingId, 
          userId,
          parsedTastingId,
          parsedUserId,
          typeTastingId: typeof tastingId,
          typeUserId: typeof userId
        });
        throw new Error(errorMessage);
      }

      // Log vor dem Abrufen des Teilnehmers
      console.log('Suche nach Teilnehmer:', { parsedTastingId, parsedUserId });
      
      // Hole den Teilnehmer vor dem Löschen
      const participant = await this.getParticipant(parsedTastingId, parsedUserId);
      
      if (!participant) {
        const errorMessage = 'Teilnehmer nicht gefunden';
        console.error(errorMessage, { parsedTastingId, parsedUserId });
        throw new Error(errorMessage);
      }
      
      // Log vor dem Löschen
      console.log('Lösche Teilnehmer:', { parsedTastingId, parsedUserId });
      
      // Lösche den Teilnehmer
      const result = await db
        .delete(participants)
        .where(
          and(
            eq(participants.tastingId, parsedTastingId),
            eq(participants.userId, parsedUserId)
          )
        )
        .returning();
        
      const wasRemoved = result.length > 0;
      
      if (wasRemoved) {
        console.log('Teilnehmer erfolgreich entfernt:', { parsedTastingId, parsedUserId });
      } else {
        console.error('Teilnehmer konnte nicht entfernt werden:', { parsedTastingId, parsedUserId });
      }
      
      return wasRemoved;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error('Fehler beim Entfernen des Teilnehmers:', errorMessage, error);
      throw new Error(`Fehler beim Entfernen des Teilnehmers: ${errorMessage}`);
    }
  }

  async updateParticipantScore(id: number, score: number): Promise<Participant> {
    const result = await db
      .update(participants)
      .set({ score })
      .where(eq(participants.id, id))
      .returning();
    
    return result[0];
  }

  // Guess methods
  async createGuess(insertGuess: Omit<InsertGuess, 'id'> & {
    name?: string | null,
    country?: string | null,
    region?: string | null,
    producer?: string | null,
    vintage?: string | null,
    varietals?: string[],
    rating?: number | null,
    notes?: string | null
  }): Promise<Guess> {
    // Check if a guess already exists for this participant and wine
    const existingGuess = await this.getGuessByWine(
      insertGuess.participantId,
      insertGuess.wineId
    );
    
    // If exists, update it
    if (existingGuess) {
      const result = await db
        .update(guesses)
        .set({
          ...insertGuess,
          name: insertGuess.name ?? existingGuess.name,
          country: insertGuess.country ?? existingGuess.country,
          region: insertGuess.region ?? existingGuess.region,
          producer: insertGuess.producer ?? existingGuess.producer,
          vintage: insertGuess.vintage ?? existingGuess.vintage,
          varietals: insertGuess.varietals ?? existingGuess.varietals,
          rating: insertGuess.rating ?? existingGuess.rating,
          notes: insertGuess.notes ?? existingGuess.notes,
          submittedAt: new Date()
        })
        .where(eq(guesses.id, existingGuess.id))
        .returning();
      
      return result[0];
    }
    
    // Otherwise create new
    const result = await db.insert(guesses).values({
      ...insertGuess,
      name: insertGuess.name ?? null,
      country: insertGuess.country ?? null,
      region: insertGuess.region ?? null,
      producer: insertGuess.producer ?? null,
      vintage: insertGuess.vintage ?? null,
      varietals: insertGuess.varietals ?? [],
      rating: insertGuess.rating ?? null,
      notes: insertGuess.notes ?? null,
      score: 0,
      submittedAt: new Date()
    }).returning();
    
    return result[0];
  }

  async getGuessesByParticipant(participantId: number): Promise<Guess[]> {
    return await db
      .select()
      .from(guesses)
      .where(eq(guesses.participantId, participantId));
  }

  async getGuessByWine(participantId: number, wineId: number): Promise<Guess | undefined> {
    const result = await db
      .select()
      .from(guesses)
      .where(
        and(
          eq(guesses.participantId, participantId),
          eq(guesses.wineId, wineId)
        )
      );
    
    return result[0];
  }

  async updateGuessScore(id: number, score: number): Promise<Guess> {
    const result = await db
      .update(guesses)
      .set({ score })
      .where(eq(guesses.id, id))
      .returning();
    
    return result[0];
  }

  async getParticipatingTastings(userId: number): Promise<TastingWithHost[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    try {
      const inviteeRows = await db.execute<{ tastingId: number }>(sql`SELECT tasting_id as "tastingId" FROM tasting_invitees WHERE email = ${user.email}`);
      const ids = inviteeRows.rows.map(r => r.tastingId);
      if (ids.length === 0) return [];
      const tastingRows = await db
        .select()
        .from(tastings)
        .where(inArray(tastings.id, ids));
      return tastingRows.map(t => ({
        ...t,
        hostName: 'Unbekannter Benutzer',
        hostCompany: null,
        requiresPassword: !!t.password
      }));
    } catch {
      return [];
    }
  }

  async getAvailableTastings(userId: number): Promise<TastingWithHost[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    const participatingIds = (await this.getParticipatingTastings(userId)).map(t => t.id);
    const hostedIds = (await this.getHostedTastings(userId)).map(t => t.id);
    try {
      const rows = await db
        .select()
        .from(tastings)
        .where(and(
          or(eq(tastings.isPublic, true), sql`${tastings.password} IS NOT NULL`),
          ne(tastings.hostId, userId)
        ));
      return rows
        .filter(t => !participatingIds.includes(t.id) && !hostedIds.includes(t.id))
        .map(t => ({
          ...t,
          hostName: 'Unbekannter Benutzer',
          hostCompany: null,
          requiresPassword: !!t.password
        }));
    } catch {
      return [];
    }
  }

  async getInvitedTastings(userId: number): Promise<TastingWithHost[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    try {
      const inviteeRows = await db.execute<{ tastingId: number }>(sql`SELECT tasting_id as "tastingId" FROM tasting_invitees WHERE email = ${user.email}`);
      const ids = inviteeRows.rows.map(r => r.tastingId);
      if (ids.length === 0) return [];
      const tastingRows = await db
        .select()
        .from(tastings)
        .where(inArray(tastings.id, ids));
      return tastingRows.map(t => ({
        ...t,
        hostName: 'Unbekannter Benutzer',
        hostCompany: null,
        requiresPassword: !!t.password
      }));
    } catch {
      return [];
    }
  }
}

// Export a storage instance: use database storage ONLY
export const storage: IStorage = new DatabaseStorage();
