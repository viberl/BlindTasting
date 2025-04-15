import { users, type User, type InsertUser } from "@shared/schema";
import { tastings, type Tasting, type InsertTasting } from "@shared/schema";
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
import { eq, and, desc, or, inArray } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Tasting methods
  createTasting(tasting: InsertTasting): Promise<Tasting>;
  getTasting(id: number): Promise<Tasting | undefined>;
  getAllTastings(): Promise<Tasting[]>;
  getPublicTastings(): Promise<Tasting[]>;
  getUserTastings(userId: number): Promise<Tasting[]>;
  getHostedTastings(hostId: number): Promise<Tasting[]>;
  updateTastingStatus(id: number, status: string): Promise<Tasting>;
  
  // Tasting Invitees
  addTastingInvitee(invitee: InsertTastingInvitee): Promise<TastingInvitee>;
  getTastingInvitees(tastingId: number): Promise<TastingInvitee[]>;
  
  // Scoring Rules
  createScoringRule(rule: InsertScoringRule): Promise<ScoringRule>;
  getScoringRule(tastingId: number): Promise<ScoringRule | undefined>;
  
  // Flight methods
  createFlight(flight: InsertFlight): Promise<Flight>;
  getFlightsByTasting(tastingId: number): Promise<Flight[]>;
  updateFlightTimes(id: number, startedAt?: Date, completedAt?: Date): Promise<Flight>;
  
  // Wine methods
  createWine(wine: InsertWine): Promise<Wine>;
  getWinesByFlight(flightId: number): Promise<Wine[]>;
  getWineById(id: number): Promise<Wine | undefined>;
  
  // Participant methods
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  getParticipantsByTasting(tastingId: number): Promise<Participant[]>;
  getParticipant(tastingId: number, userId: number): Promise<Participant | undefined>;
  updateParticipantScore(id: number, score: number): Promise<Participant>;
  
  // Guess methods
  createGuess(guess: InsertGuess): Promise<Guess>;
  getGuessesByParticipant(participantId: number): Promise<Guess[]>;
  getGuessByWine(participantId: number, wineId: number): Promise<Guess | undefined>;
  updateGuessScore(id: number, score: number): Promise<Guess>;
  
  // Session store
  sessionStore: any; // Wir verwenden any statt session.SessionStore für Typsicherheit
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tastings: Map<number, Tasting>;
  private tastingInvitees: TastingInvitee[];
  private scoringRules: Map<number, ScoringRule>;
  private flights: Map<number, Flight>;
  private wines: Map<number, Wine>;
  private participants: Map<number, Participant>;
  private guesses: Map<number, Guess>;

  sessionStore: any;
  
  private userIdCounter: number = 1;
  private tastingIdCounter: number = 1;
  private scoringRuleIdCounter: number = 1;
  private flightIdCounter: number = 1;
  private wineIdCounter: number = 1;
  private participantIdCounter: number = 1;
  private guessIdCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.tastings = new Map();
    this.tastingInvitees = [];
    this.scoringRules = new Map();
    this.flights = new Map();
    this.wines = new Map();
    this.participants = new Map();
    this.guesses = new Map();
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Clear expired sessions every 24h
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const createdAt = new Date();
    const user: User = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
  }

  // Tasting methods
  async createTasting(insertTasting: InsertTasting): Promise<Tasting> {
    const id = this.tastingIdCounter++;
    const createdAt = new Date();
    const tasting: Tasting = { 
      ...insertTasting, 
      id, 
      createdAt, 
      completedAt: null,
      status: "draft" 
    };
    this.tastings.set(id, tasting);
    return tasting;
  }

  async getTasting(id: number): Promise<Tasting | undefined> {
    return this.tastings.get(id);
  }

  async getAllTastings(): Promise<Tasting[]> {
    return Array.from(this.tastings.values());
  }

  async getPublicTastings(): Promise<Tasting[]> {
    return Array.from(this.tastings.values()).filter(
      (tasting) => tasting.isPublic && tasting.status === "active"
    );
  }

  async getUserTastings(userId: number): Promise<Tasting[]> {
    // Get public tastings and tastings where the user is invited
    const userInvitedTastingIds = this.tastingInvitees
      .filter(invitee => {
        const user = this.users.get(userId);
        return user && invitee.email.toLowerCase() === user.email.toLowerCase();
      })
      .map(invitee => invitee.tastingId);

    return Array.from(this.tastings.values()).filter(
      (tasting) => 
        (tasting.isPublic && tasting.status === "active") || 
        userInvitedTastingIds.includes(tasting.id)
    );
  }

  async getHostedTastings(hostId: number): Promise<Tasting[]> {
    return Array.from(this.tastings.values()).filter(
      (tasting) => tasting.hostId === hostId
    );
  }

  async updateTastingStatus(id: number, status: string): Promise<Tasting> {
    const tasting = this.tastings.get(id);
    if (!tasting) {
      throw new Error(`Tasting with id ${id} not found`);
    }
    
    const updatedTasting = { 
      ...tasting, 
      status,
      completedAt: status === "completed" ? new Date() : tasting.completedAt
    };
    
    this.tastings.set(id, updatedTasting);
    return updatedTasting;
  }

  // Tasting Invitees
  async addTastingInvitee(invitee: InsertTastingInvitee): Promise<TastingInvitee> {
    // Check if already exists
    const existing = this.tastingInvitees.find(
      (i) => i.tastingId === invitee.tastingId && i.email === invitee.email
    );
    
    if (!existing) {
      this.tastingInvitees.push(invitee);
    }
    
    return invitee;
  }

  async getTastingInvitees(tastingId: number): Promise<TastingInvitee[]> {
    return this.tastingInvitees.filter(
      (invitee) => invitee.tastingId === tastingId
    );
  }

  // Scoring Rules
  async createScoringRule(rule: InsertScoringRule): Promise<ScoringRule> {
    const id = this.scoringRuleIdCounter++;
    const scoringRule: ScoringRule = { ...rule, id };
    this.scoringRules.set(id, scoringRule);
    return scoringRule;
  }

  async getScoringRule(tastingId: number): Promise<ScoringRule | undefined> {
    return Array.from(this.scoringRules.values()).find(
      (rule) => rule.tastingId === tastingId
    );
  }

  // Flight methods
  async createFlight(insertFlight: InsertFlight): Promise<Flight> {
    const id = this.flightIdCounter++;
    const flight: Flight = { 
      ...insertFlight, 
      id, 
      startedAt: null,
      completedAt: null 
    };
    this.flights.set(id, flight);
    return flight;
  }

  async getFlightsByTasting(tastingId: number): Promise<Flight[]> {
    return Array.from(this.flights.values())
      .filter((flight) => flight.tastingId === tastingId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async updateFlightTimes(id: number, startedAt?: Date, completedAt?: Date): Promise<Flight> {
    const flight = this.flights.get(id);
    if (!flight) {
      throw new Error(`Flight with id ${id} not found`);
    }
    
    const updatedFlight = { 
      ...flight, 
      startedAt: startedAt !== undefined ? startedAt : flight.startedAt,
      completedAt: completedAt !== undefined ? completedAt : flight.completedAt
    };
    
    this.flights.set(id, updatedFlight);
    return updatedFlight;
  }

  // Wine methods
  async createWine(insertWine: InsertWine): Promise<Wine> {
    const id = this.wineIdCounter++;
    const wine: Wine = { ...insertWine, id };
    this.wines.set(id, wine);
    return wine;
  }

  async getWinesByFlight(flightId: number): Promise<Wine[]> {
    return Array.from(this.wines.values())
      .filter((wine) => wine.flightId === flightId)
      .sort((a, b) => a.letterCode.localeCompare(b.letterCode));
  }

  async getWineById(id: number): Promise<Wine | undefined> {
    return this.wines.get(id);
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
    
    const id = this.participantIdCounter++;
    const joinedAt = new Date();
    const participant: Participant = { 
      ...insertParticipant, 
      id, 
      joinedAt,
      score: 0 
    };
    this.participants.set(id, participant);
    return participant;
  }

  async getParticipantsByTasting(tastingId: number): Promise<Participant[]> {
    return Array.from(this.participants.values())
      .filter((participant) => participant.tastingId === tastingId)
      .sort((a, b) => b.score - a.score); // Sort by score descending
  }

  async getParticipant(tastingId: number, userId: number): Promise<Participant | undefined> {
    return Array.from(this.participants.values()).find(
      (participant) => participant.tastingId === tastingId && participant.userId === userId
    );
  }

  async updateParticipantScore(id: number, score: number): Promise<Participant> {
    const participant = this.participants.get(id);
    if (!participant) {
      throw new Error(`Participant with id ${id} not found`);
    }
    
    const updatedParticipant = { ...participant, score };
    this.participants.set(id, updatedParticipant);
    return updatedParticipant;
  }

  // Guess methods
  async createGuess(insertGuess: InsertGuess): Promise<Guess> {
    // Check if a guess already exists for this participant and wine
    const existingGuess = await this.getGuessByWine(
      insertGuess.participantId, 
      insertGuess.wineId
    );
    
    // If exists, update it
    if (existingGuess) {
      const updatedGuess: Guess = { 
        ...existingGuess, 
        ...insertGuess,
        id: existingGuess.id,
        score: existingGuess.score,
        submittedAt: new Date()
      };
      this.guesses.set(existingGuess.id, updatedGuess);
      return updatedGuess;
    }
    
    // Otherwise create new
    const id = this.guessIdCounter++;
    const submittedAt = new Date();
    const guess: Guess = { 
      ...insertGuess, 
      id, 
      score: 0,
      submittedAt 
    };
    this.guesses.set(id, guess);
    return guess;
  }

  async getGuessesByParticipant(participantId: number): Promise<Guess[]> {
    return Array.from(this.guesses.values())
      .filter((guess) => guess.participantId === participantId);
  }

  async getGuessByWine(participantId: number, wineId: number): Promise<Guess | undefined> {
    return Array.from(this.guesses.values()).find(
      (guess) => guess.participantId === participantId && guess.wineId === wineId
    );
  }

  async updateGuessScore(id: number, score: number): Promise<Guess> {
    const guess = this.guesses.get(id);
    if (!guess) {
      throw new Error(`Guess with id ${id} not found`);
    }
    
    const updatedGuess = { ...guess, score };
    this.guesses.set(id, updatedGuess);
    return updatedGuess;
  }
}

// DatabaseStorage Implementierung
export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    const PostgresSessionStore = connectPgSimple(session);
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Tasting methods
  async createTasting(insertTasting: InsertTasting): Promise<Tasting> {
    const result = await db.insert(tastings).values(insertTasting).returning();
    return result[0];
  }

  async getTasting(id: number): Promise<Tasting | undefined> {
    const result = await db.select().from(tastings).where(eq(tastings.id, id));
    return result[0];
  }

  async getAllTastings(): Promise<Tasting[]> {
    return await db.select().from(tastings);
  }

  async getPublicTastings(): Promise<Tasting[]> {
    return await db.select().from(tastings).where(
      and(
        eq(tastings.isPublic, true),
        eq(tastings.status, "active")
      )
    );
  }

  async getUserTastings(userId: number): Promise<Tasting[]> {
    // Get user email
    const user = await this.getUser(userId);
    if (!user) {
      return [];
    }

    // Get tasting IDs where user is invited
    const inviteResults = await db.select().from(tastingInvitees).where(
      eq(tastingInvitees.email, user.email.toLowerCase())
    );
    const invitedTastingIds = inviteResults.map(invite => invite.tastingId);

    // Get public active tastings and tastings where user is invited
    if (invitedTastingIds.length > 0) {
      return await db.select().from(tastings).where(
        or(
          and(
            eq(tastings.isPublic, true),
            eq(tastings.status, "active")
          ),
          inArray(tastings.id, invitedTastingIds)
        )
      );
    } else {
      return await db.select().from(tastings).where(
        and(
          eq(tastings.isPublic, true),
          eq(tastings.status, "active")
        )
      );
    }
  }

  async getHostedTastings(hostId: number): Promise<Tasting[]> {
    return await db.select().from(tastings).where(eq(tastings.hostId, hostId));
  }

  async updateTastingStatus(id: number, status: string): Promise<Tasting> {
    const updateValues: Partial<Tasting> = { status };
    
    if (status === "completed") {
      updateValues.completedAt = new Date();
    }
    
    const result = await db
      .update(tastings)
      .set(updateValues)
      .where(eq(tastings.id, id))
      .returning();
    
    return result[0];
  }

  // Tasting Invitees
  async addTastingInvitee(invitee: InsertTastingInvitee): Promise<TastingInvitee> {
    try {
      const result = await db.insert(tastingInvitees).values(invitee).returning();
      return result[0];
    } catch (error) {
      // If there's a duplicate, just return the invitee
      return invitee;
    }
  }

  async getTastingInvitees(tastingId: number): Promise<TastingInvitee[]> {
    return await db
      .select()
      .from(tastingInvitees)
      .where(eq(tastingInvitees.tastingId, tastingId));
  }

  // Scoring Rules
  async createScoringRule(rule: InsertScoringRule): Promise<ScoringRule> {
    const result = await db.insert(scoringRules).values(rule).returning();
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
  async createFlight(flight: InsertFlight): Promise<Flight> {
    const result = await db.insert(flights).values(flight).returning();
    return result[0];
  }

  async getFlightsByTasting(tastingId: number): Promise<Flight[]> {
    return await db
      .select()
      .from(flights)
      .where(eq(flights.tastingId, tastingId))
      .orderBy(flights.orderIndex);
  }

  async updateFlightTimes(id: number, startedAt?: Date, completedAt?: Date): Promise<Flight> {
    const flight = await db.select().from(flights).where(eq(flights.id, id)).then(res => res[0]);
    
    if (!flight) {
      throw new Error(`Flight with id ${id} not found`);
    }
    
    const updateValues: Partial<Flight> = {};
    
    if (startedAt !== undefined) {
      updateValues.startedAt = startedAt;
    }
    
    if (completedAt !== undefined) {
      updateValues.completedAt = completedAt;
    }
    
    const result = await db
      .update(flights)
      .set(updateValues)
      .where(eq(flights.id, id))
      .returning();
    
    return result[0];
  }

  // Wine methods
  async createWine(wine: InsertWine): Promise<Wine> {
    const result = await db.insert(wines).values(wine).returning();
    return result[0];
  }

  async getWinesByFlight(flightId: number): Promise<Wine[]> {
    return await db
      .select()
      .from(wines)
      .where(eq(wines.flightId, flightId))
      .orderBy(wines.letterCode);
  }

  async getWineById(id: number): Promise<Wine | undefined> {
    const result = await db.select().from(wines).where(eq(wines.id, id));
    return result[0];
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
    
    const result = await db.insert(participants).values({
      ...participant,
      joinedAt: new Date(),
      score: 0
    }).returning();
    
    return result[0];
  }

  async getParticipantsByTasting(tastingId: number): Promise<Participant[]> {
    return await db
      .select()
      .from(participants)
      .where(eq(participants.tastingId, tastingId))
      .orderBy(desc(participants.score));
  }

  async getParticipant(tastingId: number, userId: number): Promise<Participant | undefined> {
    const result = await db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.tastingId, tastingId),
          eq(participants.userId, userId)
        )
      );
    
    return result[0];
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
  async createGuess(insertGuess: InsertGuess): Promise<Guess> {
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
          submittedAt: new Date()
        })
        .where(eq(guesses.id, existingGuess.id))
        .returning();
      
      return result[0];
    }
    
    // Otherwise create new
    const result = await db.insert(guesses).values({
      ...insertGuess,
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
}

export const storage = new DatabaseStorage();
