var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import "dotenv/config";
import express2 from "express";
import cookieParser from "cookie-parser";
import session3 from "express-session";

// server/routes.ts
import { createServer } from "http";
import { WebSocketServer } from "ws";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  flights: () => flights,
  guesses: () => guesses,
  insertFlightSchema: () => insertFlightSchema,
  insertGuessSchema: () => insertGuessSchema,
  insertParticipantSchema: () => insertParticipantSchema,
  insertScoringRuleSchema: () => insertScoringRuleSchema,
  insertTastingInviteeSchema: () => insertTastingInviteeSchema,
  insertTastingSchema: () => insertTastingSchema,
  insertUserSchema: () => insertUserSchema,
  insertWineSchema: () => insertWineSchema,
  participants: () => participants,
  scoringRules: () => scoringRules,
  tastingInvitees: () => tastingInvitees,
  tastings: () => tastings,
  users: () => users2,
  wines: () => wines
});
import { pgTable, text, serial, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users2 = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  profileImage: text("profile_image").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users2).pick({
  email: true,
  password: true,
  name: true,
  company: true,
  profileImage: true
});
var tastings = pgTable("tastings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hostId: integer("host_id").notNull().references(() => users2.id),
  isPublic: boolean("is_public").default(true).notNull(),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").default("draft").notNull()
  // draft, active, completed
});
var insertTastingSchema = createInsertSchema(tastings).pick({
  name: true,
  hostId: true,
  isPublic: true,
  password: true
});
var tastingInvitees = pgTable("tasting_invitees", {
  tastingId: integer("tasting_id").notNull().references(() => tastings.id),
  email: text("email").notNull()
}, (t) => ({
  pk: primaryKey(t.tastingId, t.email)
}));
var insertTastingInviteeSchema = createInsertSchema(tastingInvitees);
var scoringRules = pgTable("scoring_rules", {
  id: serial("id").primaryKey(),
  tastingId: integer("tasting_id").notNull().references(() => tastings.id),
  country: integer("country").default(0).notNull(),
  region: integer("region").default(0).notNull(),
  producer: integer("producer").default(0).notNull(),
  wineName: integer("wine_name").default(0).notNull(),
  vintage: integer("vintage").default(0).notNull(),
  varietals: integer("varietals").default(0).notNull(),
  anyVarietalPoint: boolean("any_varietal_point").default(false).notNull(),
  displayCount: integer("display_count")
});
var insertScoringRuleSchema = createInsertSchema(scoringRules).pick({
  tastingId: true,
  country: true,
  region: true,
  producer: true,
  wineName: true,
  vintage: true,
  varietals: true,
  anyVarietalPoint: true,
  displayCount: true
});
var flights = pgTable("flights", {
  id: serial("id").primaryKey(),
  tastingId: integer("tasting_id").notNull().references(() => tastings.id),
  name: text("name").notNull(),
  orderIndex: integer("order_index").notNull(),
  timeLimit: integer("time_limit").default(600).notNull(),
  // in seconds
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at")
});
var insertFlightSchema = createInsertSchema(flights).pick({
  tastingId: true,
  name: true,
  orderIndex: true,
  timeLimit: true
});
var wines = pgTable("wines", {
  id: serial("id").primaryKey(),
  flightId: integer("flight_id").notNull().references(() => flights.id),
  letterCode: text("letter_code").notNull(),
  // A, B, C, etc.
  country: text("country").notNull(),
  region: text("region").notNull(),
  producer: text("producer").notNull(),
  name: text("name").notNull(),
  vintage: text("vintage").notNull(),
  varietals: text("varietals").array().notNull(),
  vinaturelId: text("vinaturel_id"),
  isCustom: boolean("is_custom").default(false).notNull()
});
var insertWineSchema = createInsertSchema(wines).pick({
  flightId: true,
  letterCode: true,
  country: true,
  region: true,
  producer: true,
  name: true,
  vintage: true,
  varietals: true,
  vinaturelId: true,
  isCustom: true
});
var participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  tastingId: integer("tasting_id").notNull().references(() => tastings.id),
  userId: integer("user_id").notNull().references(() => users2.id),
  name: text("name").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  score: integer("score").default(0).notNull()
});
var insertParticipantSchema = createInsertSchema(participants).pick({
  tastingId: true,
  userId: true,
  name: true
}).extend({
  name: z.string().optional()
});
var guesses = pgTable("guesses", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id").notNull().references(() => participants.id),
  wineId: integer("wine_id").notNull().references(() => wines.id),
  country: text("country"),
  region: text("region"),
  producer: text("producer"),
  name: text("name"),
  vintage: text("vintage"),
  varietals: text("varietals").array(),
  rating: integer("rating"),
  notes: text("notes"),
  score: integer("score").default(0).notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull()
});
var insertGuessSchema = createInsertSchema(guesses).pick({
  participantId: true,
  wineId: true,
  country: true,
  region: true,
  producer: true,
  name: true,
  vintage: true,
  varietals: true,
  rating: true,
  notes: true
});

// server/storage.ts
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";

// server/db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
console.log("Database connection URL:", process.env.DATABASE_URL);
console.log("Environment variables:", {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_TYPE: process.env.DATABASE_TYPE
});
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, and, desc, or, inArray, ilike, ne } from "drizzle-orm";
import { Pool as Pool2 } from "pg";
var MemoryStore = createMemoryStore(session);
var DatabaseStorage = class {
  constructor() {
    this.hostInfoCache = /* @__PURE__ */ new Map();
    console.log("Current storage implementation:", this.constructor.name);
    const PostgresSessionStore = connectPgSimple(session);
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL
      },
      createTableIfMissing: true
    });
  }
  // User methods
  async getUser(id) {
    try {
      const result = await db.select().from(users2).where(eq(users2.id, id));
      return result[0];
    } catch (error) {
      console.error(`Error fetching user with ID ${id}:`, error);
      return void 0;
    }
  }
  async getUserByEmail(email) {
    const normalized = email.trim().toLowerCase();
    const result = await db.select().from(users2).where(eq(users2.email, normalized));
    return result[0];
  }
  async createUser(insertUser) {
    const result = await db.insert(users2).values(insertUser).returning();
    return result[0];
  }
  // Tasting methods
  async createTasting(tasting) {
    const hostId = tasting.hostId;
    try {
      const result = await db.insert(tastings).values({
        ...tasting,
        hostId,
        createdAt: /* @__PURE__ */ new Date(),
        status: "active",
        completedAt: null
      }).returning();
      if (!result[0]) {
        throw new Error("Failed to create tasting");
      }
      return result[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error creating tasting:", errorMessage);
      throw new Error(`Failed to create tasting: ${errorMessage}`);
    }
  }
  async getTasting(id) {
    try {
      const result = await db.select().from(tastings).where(eq(tastings.id, id));
      const tasting = result[0];
      if (!tasting) return void 0;
      const host = await this.getUser(tasting.hostId);
      return {
        ...tasting,
        hostName: host?.name || "Unbekannt",
        hostCompany: host?.company || null
      };
    } catch (error) {
      console.error("Error in getTasting:", error);
      return void 0;
    }
  }
  async getAllTastings() {
    return await db.select().from(tastings);
  }
  async getPublicTastings() {
    try {
      const publicTastings = await db.select({
        id: tastings.id,
        name: tastings.name,
        hostId: tastings.hostId,
        isPublic: tastings.isPublic,
        password: tastings.password,
        createdAt: tastings.createdAt,
        completedAt: tastings.completedAt,
        status: tastings.status
      }).from(tastings).where(
        and(
          eq(tastings.isPublic, true),
          eq(tastings.status, "active")
        )
      );
      if (!publicTastings || publicTastings.length === 0) {
        return [];
      }
      const hostIds = Array.from(new Set(publicTastings.map((t) => t.hostId)));
      const hostUsers = await db.select().from(users2).where(inArray(users2.id, hostIds));
      const hostMap = new Map(hostUsers.map((user) => [user.id, user]));
      return publicTastings.map((tasting) => {
        const hostUser = hostMap.get(tasting.hostId);
        return {
          ...tasting,
          hostName: hostUser?.name || "Unbekannt",
          hostCompany: hostUser?.company || ""
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in getPublicTastings:", errorMessage);
      return [];
    }
  }
  async getUserTastings(userId) {
    console.log(`[getUserTastings] Starting for user ID: ${userId}`);
    console.log("[getUserTastings] Type definitions initialized");
    try {
      console.log("[getUserTastings] Fetching user data for ID:", userId);
      const user = await this.getUser(userId);
      if (!user) {
        console.error(`[getUserTastings] User with ID ${userId} not found`);
        return [];
      }
      console.log("[getUserTastings] User data retrieved:", { id: user.id, email: user.email, name: user.name });
      const hostedTastings = await db.select({
        id: tastings.id,
        name: tastings.name,
        hostId: tastings.hostId,
        isPublic: tastings.isPublic,
        password: tastings.password,
        createdAt: tastings.createdAt,
        completedAt: tastings.completedAt,
        status: tastings.status
      }).from(tastings).where(and(
        eq(tastings.hostId, userId),
        eq(tastings.status, "active")
      ));
      const inviteResults = await db.select({ tastingId: tastingInvitees.tastingId }).from(tastingInvitees).where(eq(tastingInvitees.email, user.email));
      const inviteeTastingIds = inviteResults.map((t) => t.tastingId);
      let invitedTastings = [];
      if (inviteeTastingIds.length > 0) {
        invitedTastings = await db.select({
          id: tastings.id,
          name: tastings.name,
          hostId: tastings.hostId,
          isPublic: tastings.isPublic,
          password: tastings.password,
          createdAt: tastings.createdAt,
          completedAt: tastings.completedAt,
          status: tastings.status
        }).from(tastings).where(and(
          inArray(tastings.id, inviteeTastingIds),
          eq(tastings.status, "active")
        ));
      }
      const publicTastings = await db.select({
        id: tastings.id,
        name: tastings.name,
        hostId: tastings.hostId,
        isPublic: tastings.isPublic,
        password: tastings.password,
        createdAt: tastings.createdAt,
        completedAt: tastings.completedAt,
        status: tastings.status
      }).from(tastings).where(and(
        eq(tastings.isPublic, true),
        eq(tastings.status, "active"),
        ne(tastings.hostId, userId)
      ));
      const allTastings = [...hostedTastings, ...invitedTastings, ...publicTastings];
      const uniqueTastings = Array.from(new Map(allTastings.map((t) => [t.id, t])).values());
      const allHostIds = [...new Set(uniqueTastings.map((t) => t.hostId))];
      console.log("[getUserTastings] Unique host IDs:", allHostIds);
      if (allHostIds.length === 0) {
        console.log("[getUserTastings] No host IDs found, returning empty array");
        return [];
      }
      let hostUsers = [];
      try {
        console.log(`[getUserTastings] Fetching host users for IDs:`, allHostIds);
        hostUsers = await db.select({
          id: users2.id,
          name: users2.name,
          company: users2.company,
          email: users2.email
        }).from(users2).where(inArray(users2.id, allHostIds));
        console.log(`[getUserTastings] Successfully fetched ${hostUsers.length} host users`);
      } catch (error) {
        console.error("[getUserTastings] Error fetching host users:", error);
        throw new Error("Failed to fetch host users");
      }
      const hostMap = /* @__PURE__ */ new Map();
      for (const host of hostUsers) {
        const hostInfo = {
          name: (host.name || "").trim() || "Unbekannter Benutzer",
          company: host.company || null,
          email: host.email || null
        };
        console.log(`[getUserTastings] Adding to host map - ID: ${host.id}, Name: '${hostInfo.name}'`);
        hostMap.set(host.id, hostInfo);
      }
      const tastingsWithHosts = [];
      for (const tasting of uniqueTastings) {
        console.log(`[getUserTastings] Processing tasting ${tasting.id}, hostId: ${tasting.hostId}`);
        let hostName = "Unbekannter Benutzer";
        let hostCompany = null;
        try {
          if (tasting.hostId === userId) {
            hostName = (user.name || "").trim() || "Unbekannter Benutzer";
            hostCompany = user.company || null;
            console.log(`[getUserTastings] Using current user as host for tasting ${tasting.id}: ${hostName}`);
          } else {
            console.log(`[getUserTastings] Looking up host ${tasting.hostId} in hostMap`);
            const hostInfo = hostMap.get(tasting.hostId);
            if (hostInfo) {
              hostName = hostInfo.name;
              hostCompany = hostInfo.company;
              console.log(`[getUserTastings] Found host info in map for tasting ${tasting.id}: ${hostName}`);
            } else {
              console.warn(`[getUserTastings] No host info in map for tasting ${tasting.id} with hostId ${tasting.hostId}, fetching from database...`);
              try {
                const hostUser = await this.getUser(tasting.hostId);
                if (hostUser) {
                  hostName = (hostUser.name || "").trim() || "Unbekannter Benutzer";
                  hostCompany = hostUser.company || null;
                  console.log(`[getUserTastings] Fetched host info directly for tasting ${tasting.id}: ${hostName}`);
                  this.hostInfoCache.set(tasting.hostId, {
                    name: hostName,
                    company: hostCompany,
                    email: hostUser.email || null
                  });
                } else {
                  console.warn(`[getUserTastings] No host found with ID ${tasting.hostId} for tasting ${tasting.id}`);
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                console.error(`[getUserTastings] Error fetching host info for tasting ${tasting.id}:`, errorMessage);
              }
            }
          }
          const tastingWithHost = {
            ...tasting,
            hostName,
            hostCompany
          };
          tastingsWithHosts.push(tastingWithHost);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`[getUserTastings] Error processing tasting ${tasting.id}:`, errorMessage);
          tastingsWithHosts.push({
            ...tasting,
            hostName: "Unbekannter Benutzer",
            hostCompany: null
          });
        }
      }
      console.log(`[getUserTastings] Returning ${tastingsWithHosts.length} tastings with host info`);
      return tastingsWithHosts;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in getUserTastings:", errorMessage);
      return [];
    }
  }
  async getHostedTastings(hostId) {
    console.log(`[getHostedTastings] Fetching tastings for host ID: ${hostId}`);
    try {
      const tastingsResult = await db.select().from(tastings).where(eq(tastings.hostId, hostId));
      console.log(`[getHostedTastings] Found ${tastingsResult.length} tastings for host ${hostId}`);
      if (!tastingsResult || tastingsResult.length === 0) {
        return [];
      }
      const host = await this.getUser(hostId);
      console.log(`[getHostedTastings] Fetched host info:`, {
        hostId: host?.id,
        name: host?.name,
        company: host?.company
      });
      if (!host) {
        console.error(`[getHostedTastings] Host with ID ${hostId} not found`);
      }
      const result = tastingsResult.map((tasting) => ({
        ...tasting,
        hostName: host?.name || "Unbekannt",
        hostCompany: host?.company || null
      }));
      console.log(`[getHostedTastings] Returning ${result.length} tastings with host info`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[getHostedTastings] Error:", errorMessage, error);
      return [];
    }
  }
  async updateTastingStatus(id, status) {
    const updateValues = { status };
    if (status === "completed") {
      updateValues.password = null;
    }
    const result = await db.update(tastings).set(updateValues).where(eq(tastings.id, id)).returning();
    return result[0];
  }
  // Tasting Invitees
  async addTastingInvitee(invitee) {
    try {
      const result = await db.insert(tastingInvitees).values(invitee).returning();
      return result[0];
    } catch (error) {
      return invitee;
    }
  }
  async getTastingInvitees(tastingId) {
    return await db.select().from(tastingInvitees).where(eq(tastingInvitees.tastingId, tastingId));
  }
  // Scoring Rules
  async createScoringRule(rule) {
    const fullRule = {
      ...rule,
      country: rule.country ?? 0,
      region: rule.region ?? 0
      // ... andere erforderliche Felder
    };
    const result = await db.insert(scoringRules).values(fullRule).returning();
    return result[0];
  }
  async getScoringRule(tastingId) {
    const result = await db.select().from(scoringRules).where(eq(scoringRules.tastingId, tastingId));
    return result[0];
  }
  // Flight methods
  async createFlight(flightData) {
    try {
      const pool2 = new Pool2({ connectionString: process.env.DATABASE_URL });
      const result = await pool2.query(`
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
      await pool2.end();
      return result.rows[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "No stack trace";
      console.error("Database error details:", {
        error: errorMessage,
        stack: errorStack,
        config: process.env.DATABASE_URL
      });
      throw new Error(`Failed to create flight: ${errorMessage}`);
    }
  }
  async getFlightsByTasting(tastingId) {
    try {
      console.log("Executing getFlightsByTasting for tastingId:", tastingId);
      const sql = `SELECT id, name, tasting_id as "tastingId", order_index as "orderIndex", 
                   time_limit as "timeLimit", started_at as "startedAt", completed_at as "completedAt" 
                   FROM flights WHERE tasting_id = $1 ORDER BY order_index`;
      console.log("SQL Query:", sql);
      const pool2 = new Pool2({ connectionString: process.env.DATABASE_URL });
      const { rows } = await pool2.query(sql, [tastingId]);
      await pool2.end();
      return rows;
    } catch (error) {
      console.error("Database error in getFlightsByTasting:", error);
      throw error;
    }
  }
  async updateFlightTimes(id, startedAt, completedAt) {
    const flight = await db.select().from(flights).where(eq(flights.id, id)).then((res) => res[0]);
    if (!flight) {
      throw new Error(`Flight with id ${id} not found`);
    }
    const updateValues = {};
    if (startedAt !== void 0) {
      updateValues.startedAt = startedAt;
    }
    if (completedAt !== void 0) {
      updateValues.completedAt = completedAt;
    }
    const result = await db.update(flights).set(updateValues).where(eq(flights.id, id)).returning();
    return result[0];
  }
  // Wine methods
  async createWine(wine) {
    const fullWine = {
      name: wine.name,
      country: wine.country,
      region: wine.region,
      producer: wine.producer,
      vintage: wine.vintage,
      varietals: wine.varietals,
      flightId: wine.flightId,
      letterCode: wine.letterCode,
      vinaturelId: wine.vinaturelId ?? null,
      isCustom: wine.isCustom ?? false
    };
    const result = await db.insert(wines).values(fullWine).returning();
    return result[0];
  }
  async getWinesByFlight(flightId) {
    console.log("[getWinesByFlight] Using DB:", process.env.DATABASE_URL);
    console.log("[getWinesByFlight] Querying for flightId:", flightId);
    const result = await db.select().from(wines).where(eq(wines.flightId, flightId)).orderBy(wines.letterCode);
    console.log("[getWinesByFlight] Result:", result);
    return result;
  }
  async getWineById(id) {
    const result = await db.select().from(wines).where(eq(wines.id, id));
    return result[0];
  }
  async searchWines(query, limit = 20) {
    return db.select().from(wines).where(
      or(
        ilike(wines.name, `%${query}%`),
        ilike(wines.producer, `%${query}%`),
        ilike(wines.region, `%${query}%`),
        ilike(wines.vintage, `%${query}%`)
      )
    ).limit(limit);
  }
  // Participant methods
  async createParticipant(participant) {
    const existingParticipant = await this.getParticipant(
      participant.tastingId,
      participant.userId
    );
    if (existingParticipant) {
      return existingParticipant;
    }
    try {
      const user = await this.getUser(participant.userId);
      if (!user) {
        throw new Error("User not found");
      }
      const participantName = participant.name || user.name || "Anonymous";
      const [newParticipant] = await db.insert(participants).values({
        tastingId: participant.tastingId,
        userId: participant.userId,
        name: participantName,
        joinedAt: /* @__PURE__ */ new Date(),
        score: 0
      }).returning();
      return newParticipant;
    } catch (error) {
      console.error("Error creating participant:", error);
      throw new Error("Failed to create participant");
    }
  }
  async getParticipantsByTasting(tastingId) {
    return await db.select().from(participants).where(eq(participants.tastingId, tastingId)).orderBy(desc(participants.score));
  }
  async getParticipant(tastingId, userId) {
    const result = await db.select().from(participants).where(
      and(
        eq(participants.tastingId, tastingId),
        eq(participants.userId, userId)
      )
    );
    return result[0];
  }
  async updateParticipantScore(id, score) {
    const result = await db.update(participants).set({ score }).where(eq(participants.id, id)).returning();
    return result[0];
  }
  // Guess methods
  async createGuess(insertGuess) {
    const existingGuess = await this.getGuessByWine(
      insertGuess.participantId,
      insertGuess.wineId
    );
    if (existingGuess) {
      const result2 = await db.update(guesses).set({
        ...insertGuess,
        name: insertGuess.name ?? existingGuess.name,
        country: insertGuess.country ?? existingGuess.country,
        region: insertGuess.region ?? existingGuess.region,
        producer: insertGuess.producer ?? existingGuess.producer,
        vintage: insertGuess.vintage ?? existingGuess.vintage,
        varietals: insertGuess.varietals ?? existingGuess.varietals,
        rating: insertGuess.rating ?? existingGuess.rating,
        notes: insertGuess.notes ?? existingGuess.notes,
        submittedAt: /* @__PURE__ */ new Date()
      }).where(eq(guesses.id, existingGuess.id)).returning();
      return result2[0];
    }
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
      submittedAt: /* @__PURE__ */ new Date()
    }).returning();
    return result[0];
  }
  async getGuessesByParticipant(participantId) {
    return await db.select().from(guesses).where(eq(guesses.participantId, participantId));
  }
  async getGuessByWine(participantId, wineId) {
    const result = await db.select().from(guesses).where(
      and(
        eq(guesses.participantId, participantId),
        eq(guesses.wineId, wineId)
      )
    );
    return result[0];
  }
  async updateGuessScore(id, score) {
    const result = await db.update(guesses).set({ score }).where(eq(guesses.id, id)).returning();
    return result[0];
  }
};
var storage = new DatabaseStorage();

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "dev-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1e3 * 60 * 60 * 24 * 14,
      // 14 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/"
    }
  };
  console.log("Session configuration initialized");
  app2.set("trust proxy", 1);
  app2.use(session2(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  app2.use((req, res, next) => {
    console.log("Session ID:", req.sessionID);
    console.log("User authenticated:", req.isAuthenticated?.());
    next();
  });
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password"
      },
      async (email, password, done) => {
        console.log("=== DATENBANK-CONNECTION DEBUG ===");
        console.log("DB-URL:", process.env.DATABASE_URL);
        console.log("Storage Instance:", storage.constructor.name);
        console.log("Session Store:", storage.sessionStore?.constructor?.name);
        try {
          const user = await storage.getUserByEmail(email.toLowerCase());
          console.log("User lookup result:", user);
          if (!user || !await comparePasswords(password, user.password)) {
            return done(null, false, { message: "Falsche E-Mail oder Passwort" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
  passport.serializeUser((user, done) => {
    console.log("=== SESSION SERIALIZATION ===");
    console.log("Serializing user:", user.id);
    console.log("Session store:", storage.sessionStore?.constructor?.name);
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Diese E-Mail-Adresse wird bereits verwendet" });
      }
      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword
      });
      req.session.userId = user.id;
      req.session.authenticated = true;
      console.log("Registrierung erfolgreich. Session-ID:", req.sessionID, "User ID:", user.id);
      req.session.save((err) => {
        if (err) {
          console.error("Session konnte nicht gespeichert werden:", err);
          return next(err);
        }
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error("Passport login fehlgeschlagen:", loginErr);
            return next(loginErr);
          }
          console.log("Session nach Speichern:", req.session);
          const { password, ...userWithoutPassword } = user;
          res.status(201).json(userWithoutPassword);
        });
      });
    } catch (error) {
      console.error("Fehler bei der Registrierung:", error);
      next(error);
    }
  });
  app2.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Anmeldung fehlgeschlagen" });
      }
      req.login(user, (err2) => {
        if (err2) return next(err2);
        req.session.userId = user.id;
        console.log("Login erfolgreich. Session-ID:", req.sessionID, "User ID:", user.id);
        req.session.save((err3) => {
          if (err3) {
            console.error("Session konnte nicht gespeichert werden:", err3);
            return next(err3);
          }
          const { password, ...userWithoutPassword } = user;
          res.json(userWithoutPassword);
        });
      });
    })(req, res, next);
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/direct-check", async (req, res) => {
    console.log("Direct check aufgerufen mit Session:", req.sessionID);
    try {
      const user = await storage.getUser(1);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        return res.json({
          ...userWithoutPassword,
          _notice: "Direkte Authentifizierung - nur f\xFCr Testzwecke"
        });
      } else {
        return res.status(404).json({ message: "Testbenutzer nicht gefunden" });
      }
    } catch (error) {
      console.error("Fehler bei direktem Test:", error);
      return res.status(500).json({ message: "Interner Serverfehler" });
    }
  });
  app2.get("/api/user", async (req, res) => {
    console.log("GET /api/user - Session ID:", req.sessionID);
    console.log("Session Info:", {
      userId: req.session.userId,
      authenticated: req.session.authenticated,
      isAuthenticated: req.isAuthenticated()
    });
    if (req.session.userId) {
      try {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          console.log("Benutzer aus Session-UserId gefunden:", user.id);
          const { password, ...userWithoutPassword } = user;
          return res.json(userWithoutPassword);
        }
      } catch (error) {
        console.error("Fehler beim Abrufen des Benutzers aus der Session:", error);
      }
    }
    if (req.isAuthenticated()) {
      console.log("Benutzer ist \xFCber Passport authentifiziert");
      const { password, ...userWithoutPassword } = req.user;
      return res.json(userWithoutPassword);
    }
    return res.status(401).json({ message: "Nicht authentifiziert" });
  });
}

// server/routes.ts
import { z as z2 } from "zod";

// server/vinaturel-api.ts
import axios from "axios";
var cachedToken = null;
async function authenticate(credentials) {
  if (cachedToken && cachedToken.expiresAt > /* @__PURE__ */ new Date()) {
    return cachedToken.token;
  }
  try {
    console.log("Authenticating with Vinaturel API using credentials:", {
      username: credentials.username,
      apiKey: credentials.apiKey ? `${credentials.apiKey.substring(0, 5)}...` : "not set"
    });
    return "success-token";
  } catch (error) {
    console.error("Authentication error:", error);
    throw new Error("Authentication failed");
  }
}
async function fetchWines(credentials, search, limit = 20, page = 1) {
  try {
    const url = search ? "https://www.vinaturel.de/store-api/search" : "https://www.vinaturel.de/store-api/product";
    const requestData = search ? { search, limit, page } : {
      limit,
      page,
      filter: [{ type: "equals", field: "active", value: "1" }]
    };
    console.log(`Fetching wines from ${url} with ${search ? "search term: " + search : "no search term"}`);
    const response = await axios.post(url, requestData, {
      headers: {
        "Content-Type": "application/json",
        "sw-access-key": credentials.apiKey,
        "Accept": "application/json"
      }
    });
    console.log("Wine search response status:", response.status);
    if (search) {
      console.log("Wine search response data structure (keys):", Object.keys(response.data));
      if (response.data.listing) {
        console.log("Listing struktur:", Object.keys(response.data.listing));
      }
      if (response.data.data) {
        console.log("Data struktur:", Object.keys(response.data.data));
      }
      console.log("Sample response data:", JSON.stringify(response.data).substring(0, 500) + "...");
    }
    let elements = [];
    if (search) {
      console.log("Search API response structure:", Object.keys(response.data));
      if (response.data.listing) {
        elements = response.data.listing.elements || [];
      } else if (response.data.elements) {
        elements = response.data.elements || [];
      } else if (response.data.data && response.data.data.elements) {
        elements = response.data.data.elements || [];
      } else if (response.data.data && response.data.data.products) {
        elements = response.data.data.products || [];
      }
    } else {
      elements = response.data.elements || [];
    }
    console.log(`Found ${elements.length} wines`);
    return elements.map((item) => {
      const varietals = extractVarietals(item);
      return {
        id: item.id,
        name: item.name || "",
        producer: extractProducer(item),
        country: extractCountry(item),
        region: extractRegion(item),
        vintage: extractVintage(item),
        varietals,
        price: item.calculatedPrice?.unitPrice || item.price?.gross || 0,
        imageUrl: extractImageUrl(item),
        description: item.description || ""
      };
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Error fetching wines from Vinaturel API:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } else {
      console.error("Error fetching wines from Vinaturel API:", error);
    }
    throw new Error("Failed to fetch wines from Vinaturel API");
  }
}
function extractProducer(item) {
  return item.manufacturer?.name || "";
}
function extractCountry(item) {
  if (item.properties) {
    const countryProp = item.properties.find(
      (prop) => prop.group?.name?.toLowerCase().includes("land") || prop.name?.toLowerCase().includes("land")
    );
    if (countryProp) {
      return countryProp.name || "";
    }
  }
  return "";
}
function extractRegion(item) {
  if (item.properties) {
    const regionProp = item.properties.find(
      (prop) => prop.group?.name?.toLowerCase().includes("region") || prop.name?.toLowerCase().includes("region")
    );
    if (regionProp) {
      return regionProp.name || "";
    }
  }
  return "";
}
function extractVintage(item) {
  if (item.properties) {
    const vintageProp = item.properties.find(
      (prop) => prop.group?.name?.toLowerCase().includes("jahrgang") || prop.name?.toLowerCase().includes("jahrgang")
    );
    if (vintageProp) {
      return vintageProp.name || "";
    }
  }
  const vintageMatch = item.name?.match(/\b(19|20)\d{2}\b/);
  if (vintageMatch) {
    return vintageMatch[0];
  }
  return "";
}
function extractVarietals(item) {
  const varietals = [];
  if (item.properties) {
    const grapeProps = item.properties.filter(
      (prop) => prop.group?.name?.toLowerCase().includes("rebsorte") || prop.name?.toLowerCase().includes("rebsorte")
    );
    if (grapeProps.length > 0) {
      grapeProps.forEach((prop) => {
        if (prop.name) {
          varietals.push(prop.name);
        }
      });
    }
  }
  return varietals;
}
function extractImageUrl(item) {
  if (item.cover && item.cover.media && item.cover.media.url) {
    return item.cover.media.url;
  }
  if (item.media && item.media.length > 0 && item.media[0].url) {
    return item.media[0].url;
  }
  return void 0;
}
var VinaturelAPI = {
  authenticate,
  fetchWines
};

// server/routes.ts
import { eq as eq2 } from "drizzle-orm";
import { Pool as Pool3 } from "pg";
async function ensureAuthenticated(req, res, next) {
  console.log("=== AUTHENTICATION CHECK ===");
  console.log("Path:", req.path);
  console.log("Session ID:", req.sessionID);
  console.log("Session data:", req.session);
  console.log("User:", req.user);
  if (req.isAuthenticated() && req.user) {
    console.log("User is authenticated via Passport, user ID:", req.user.id);
    if (!req.session) {
      req.session = {};
    }
    req.session.userId = req.user.id;
    return next();
  }
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
  if (process.env.NODE_ENV === "development") {
    console.warn("DEV MODE: Allowing access without authentication");
    console.log("Auth check debug:", {
      sessionID: req.sessionID,
      session: req.session,
      cookies: req.headers.cookie,
      headers: req.headers
    });
    if (!req.user) {
      try {
        const testUser = await storage.getUserByEmail("test@example.com") || await storage.createUser({
          email: "test@example.com",
          name: "Test User",
          company: "Test Company",
          password: "password123",
          profileImage: ""
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
async function registerRoutes(app2) {
  const joinRooms = /* @__PURE__ */ new Map();
  setupAuth(app2);
  app2.get("/api/vinaturel/wines", process.env.NODE_ENV === "development" ? (req, res, next) => next() : ensureAuthenticated, async (req, res) => {
    try {
      const credentials = {
        username: process.env.VINATUREL_USERNAME || "",
        password: process.env.VINATUREL_PASSWORD || "",
        apiKey: process.env.VINATUREL_API_KEY || ""
      };
      console.log("Vinaturel API credentials used:", {
        username: credentials.username ? credentials.username : "not set",
        password: credentials.password ? "is set" : "not set",
        apiKey: credentials.apiKey ? `${credentials.apiKey.substring(0, 5)}...` : "not set"
      });
      if (!credentials.username || !credentials.password || !credentials.apiKey) {
        return res.status(500).json({
          error: "Vinaturel API credentials not set",
          missingCredentials: {
            username: !credentials.username,
            password: !credentials.password,
            apiKey: !credentials.apiKey
          }
        });
      }
      const limit = parseInt(req.query.limit) || 20;
      const page = parseInt(req.query.page) || 1;
      const wines2 = await VinaturelAPI.fetchWines(credentials, void 0, limit, page);
      res.json(wines2);
    } catch (error) {
      console.error("Error fetching Vinaturel wines:", error);
      res.status(500).json({ error: "Failed to fetch wines from Vinaturel" });
    }
  });
  console.log("Registering /api/wines/search route");
  app2.get("/api/wines/search", async (req, res) => {
    console.log("Handling search via DB", { query: req.query.q });
  });
  app2.get("/api/wines/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Suchparameter fehlt" });
      }
      const results = await storage.searchWines(q);
      res.json(results);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Suche fehlgeschlagen" });
    }
  });
  app2.get("/api/tastings", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Nicht autorisiert" });
      }
      console.log("UserId:", userId);
      const [hostedTastings, userTastings] = await Promise.all([
        storage.getHostedTastings(userId),
        storage.getUserTastings(userId)
      ]);
      console.log(`Gefundene gehostete Verkostungen: ${hostedTastings.length}`);
      console.log(`Gefundene Benutzerverkostungen: ${userTastings.length}`);
      const participatingTastings = [];
      for (const tasting of userTastings) {
        const participant = await storage.getParticipant(tasting.id, userId);
        if (participant) {
          participatingTastings.push(tasting);
        }
      }
      const availableTastings = userTastings.filter(
        (t) => !hostedTastings.some((h) => h.id === t.id) && !participatingTastings.some((p) => p.id === t.id)
      );
      console.log(`Teilnehmende Verkostungen: ${participatingTastings.length}`);
      console.log(`Verf\xFCgbare Verkostungen: ${availableTastings.length}`);
      res.json({
        hosted: hostedTastings,
        participating: participatingTastings,
        available: availableTastings,
        isAuthenticated: true
      });
    } catch (error) {
      console.error("Fehler in /api/tastings:", error);
      res.status(500).json({
        error: "Ein Fehler ist aufgetreten",
        details: error.message
      });
    }
  });
  app2.post("/api/tastings", ensureAuthenticated, async (req, res) => {
    console.log("Session User:", req.user?.id);
    console.log("Session ID:", req.sessionID);
    console.log("Session Store:", storage.sessionStore);
    try {
      let userId = void 0;
      if (req.user && req.user.id) {
        userId = req.user.id;
      } else if (req.session && req.session.userId) {
        userId = req.session.userId;
      }
      if (!userId) {
        return res.status(401).json({ error: "Kein User eingeloggt" });
      }
      console.log("Verk. wird erstellt von User:", userId);
      const tastingData = insertTastingSchema.parse({
        ...req.body,
        hostId: userId
      });
      const tasting = await storage.createTasting(tastingData);
      if (!tasting.isPublic && req.body.invitees) {
        const invitees = req.body.invitees;
        for (const email of invitees) {
          await storage.addTastingInvitee({
            tastingId: tasting.id,
            email
          });
        }
      }
      res.status(201).json(tasting);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app2.get("/api/tastings/:id", async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      if (!tasting.status) {
        tasting.status = "draft";
      }
      res.json(tasting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.patch("/api/tastings/:id/status", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const { status } = req.body;
      if (!status || !["draft", "saved", "active", "completed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      if (req.user && tasting.hostId !== req.user.id) {
        return res.status(403).json({ error: "Only the host can update the tasting status" });
      }
      if (status === "active") {
        const flights3 = await storage.getFlightsByTasting(tastingId);
        if (!flights3 || flights3.length === 0) {
          return res.status(400).json({ error: "Tasting requires at least one flight to be activated" });
        }
        let hasWines = false;
        for (const flight of flights3) {
          const wines2 = await storage.getWinesByFlight(flight.id);
          if (wines2 && wines2.length > 0) {
            hasWines = true;
            break;
          }
        }
        if (!hasWines) {
          return res.status(400).json({ error: "Tasting requires at least one wine in a flight to be activated" });
        }
        const scoringRules2 = await storage.getScoringRule(tastingId);
        if (!scoringRules2) {
          await storage.createScoringRule({
            tastingId,
            country: 1,
            region: 1,
            producer: 2,
            wineName: 2,
            vintage: 1,
            varietals: 1,
            anyVarietalPoint: true
          });
        }
      }
      const updatedTasting = await storage.updateTastingStatus(tastingId, status);
      res.json(updatedTasting);
    } catch (error) {
      console.error("Error updating tasting status:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/tastings/:id/scoring", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      if (tasting.hostId !== req.user.id) {
        return res.status(403).json({ error: "Only the host can set scoring rules" });
      }
      const scoringRuleData = insertScoringRuleSchema.parse({
        ...req.body,
        tastingId
      });
      const existingRules = await storage.getScoringRule(tastingId);
      if (existingRules) {
        return res.status(400).json({ error: "Scoring rules already exist for this tasting" });
      }
      const scoringRule = await storage.createScoringRule(scoringRuleData);
      res.status(201).json(scoringRule);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });
  app2.get("/api/tastings/:id/scoring", ensureAuthenticated, async (req, res) => {
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
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/tastings/:tastingId/flights", ensureAuthenticated, async (req, res) => {
    console.log("Request body:", req.body);
    const tastingId = parseInt(req.params.tastingId);
    console.log("Creating flight for tasting:", tastingId);
    try {
      const existingFlights = await storage.getFlightsByTasting(tastingId);
      const flightData = {
        tastingId,
        name: `Flight ${existingFlights.length + 1}`,
        orderIndex: existingFlights.length,
        timeLimit: 1800
      };
      console.log("Flight data to create:", flightData);
      const flight = await storage.createFlight(flightData);
      res.status(201).json(flight);
    } catch (error) {
      console.error("Flight creation error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/tastings/:tastingId/flights", ensureAuthenticated, async (req, res) => {
    const tastingId = parseInt(req.params.tastingId);
    console.log("Fetching flights for tasting:", tastingId);
    try {
      const flights3 = await storage.getFlightsByTasting(tastingId);
      const flightsWithWines = await Promise.all(
        flights3.map(async (flight) => {
          const wines2 = await storage.getWinesByFlight(flight.id);
          return { ...flight, wines: wines2 };
        })
      );
      console.log("Flights result:", flightsWithWines);
      res.json(flightsWithWines);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/flights/:id/start", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      const flights3 = Array.from(await storage.getAllTastings()).flatMap(async (tasting2) => {
        return await storage.getFlightsByTasting(tasting2.id);
      });
      const flight = (await Promise.all(flights3)).flat().find((f) => f.id === flightId);
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      const updatedFlight = await storage.updateFlightTimes(flightId, /* @__PURE__ */ new Date(), void 0);
      res.json(updatedFlight);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/flights/:id/timer", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      const { minutes } = req.body;
      if (!minutes || typeof minutes !== "number" || minutes <= 0) {
        return res.status(400).json({ error: "Valid timer minutes required (greater than 0)" });
      }
      const flights3 = Array.from(await storage.getAllTastings()).flatMap(async (tasting2) => {
        return await storage.getFlightsByTasting(tasting2.id);
      });
      const flight = (await Promise.all(flights3)).flat().find((f) => f.id === flightId);
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      if (!flight.startedAt) {
        return res.status(400).json({ error: "Flight must be started before setting a timer" });
      }
      if (flight.completedAt) {
        return res.status(400).json({ error: "Cannot set timer for completed flight" });
      }
      const tasting = await storage.getTasting(flight.tastingId);
      setTimeout(async () => {
        try {
          const currentFlight = await db.select().from(flights3).where(eq2(flights3.id, flightId)).limit(1);
          if (currentFlight.length > 0 && currentFlight[0].startedAt && !currentFlight[0].completedAt) {
            console.log(`Timer abgelaufen f\xFCr Flight ${flightId}, beende automatisch`);
            await storage.updateFlightTimes(flightId, currentFlight[0].startedAt, /* @__PURE__ */ new Date());
          }
        } catch (error) {
          console.error("Fehler beim automatischen Beenden des Flights:", error);
        }
      }, timeLimit * 1e3);
    } catch (error) {
      console.error("Error setting flight timer:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/flights/:id/complete", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      const flights3 = Array.from(await storage.getAllTastings()).flatMap(async (tasting2) => {
        return await storage.getFlightsByTasting(tasting2.id);
      });
      const flight = (await Promise.all(flights3)).flat().find((f) => f.id === flightId);
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      const updatedFlight = await storage.updateFlightTimes(flightId, flight.startedAt || /* @__PURE__ */ new Date(), /* @__PURE__ */ new Date());
      const wines2 = await storage.getWinesByFlight(flightId);
      const participants2 = await storage.getParticipantsByTasting(tasting.id);
      const scoringRules2 = await storage.getScoringRule(tasting.id);
      if (scoringRules2) {
        for (const participant of participants2) {
          let totalScore = 0;
          for (const wine of wines2) {
            const guess = await storage.getGuessByWine(participant.id, wine.id);
            if (guess) {
              let guessScore = 0;
              if (guess.country && wine.country === guess.country) {
                guessScore += scoringRules2.country;
              }
              if (guess.region && wine.region === guess.region) {
                guessScore += scoringRules2.region;
              }
              if (guess.producer && wine.producer === guess.producer) {
                guessScore += scoringRules2.producer;
              }
              if (guess.name && wine.name === guess.name) {
                guessScore += scoringRules2.wineName;
              }
              if (guess.vintage && wine.vintage === guess.vintage) {
                guessScore += scoringRules2.vintage;
              }
              if (guess.varietals && guess.varietals.length > 0 && scoringRules2.varietals > 0) {
                if (scoringRules2.anyVarietalPoint) {
                  if (guess.varietals.some((v) => wine.varietals.includes(v))) {
                    guessScore += scoringRules2.varietals;
                  }
                } else {
                  if (guess.varietals.length === wine.varietals.length && guess.varietals.every((v) => wine.varietals.includes(v))) {
                    guessScore += scoringRules2.varietals;
                  }
                }
              }
              await storage.updateGuessScore(guess.id, guessScore);
              totalScore += guessScore;
            }
          }
          const currentScore = participant.score || 0;
          await storage.updateParticipantScore(participant.id, currentScore + totalScore);
        }
      }
      res.json(updatedFlight);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/flights/:id/wines", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      const flights3 = Array.from(await storage.getAllTastings()).flatMap(async (tasting2) => {
        return await storage.getFlightsByTasting(tasting2.id);
      });
      const flight = (await Promise.all(flights3)).flat().find((f) => f.id === flightId);
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      const existingWines = await storage.getWinesByFlight(flightId);
      const letterCodeIndex = existingWines.length;
      const letterCode = String.fromCharCode(65 + letterCodeIndex);
      const wineData = insertWineSchema.parse({
        ...req.body,
        flightId,
        letterCode
      });
      const wine = await storage.createWine(wineData);
      res.status(201).json(wine);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });
  app2.get("/api/flights/:id/wines", async (req, res) => {
    try {
      const flightId = parseInt(req.params.id);
      const wines2 = await storage.getWinesByFlight(flightId);
      res.json(wines2);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/tastings/:id/join", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const userId = req.user.id;
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      if (tasting.status !== "active") {
        return res.status(400).json({ error: "Tasting is not active" });
      }
      if (!tasting.isPublic && tasting.password) {
        const { password } = req.body;
        if (!password || password !== tasting.password) {
          return res.status(403).json({ error: "Invalid password" });
        }
      }
      if (!tasting.isPublic && !tasting.password) {
        const invitees = await storage.getTastingInvitees(tastingId);
        const userEmail = req.user.email;
        if (!invitees.some((invitee) => invitee.email.toLowerCase() === userEmail.toLowerCase())) {
          return res.status(403).json({ error: "You are not invited to this tasting" });
        }
      }
      const existingParticipant = await storage.getParticipant(tastingId, userId);
      if (!existingParticipant) {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        const { name } = req.body;
        await storage.createParticipant({
          tastingId,
          userId,
          name: name || user.name,
          score: 0
        });
      }
      const sockets = joinRooms.get(tastingId);
      if (sockets) {
        const participants2 = await storage.getParticipantsByTasting(tastingId);
        const message = JSON.stringify({ participants: participants2 });
        sockets.forEach((ws) => {
          if (ws.readyState === 1) ws.send(message);
        });
      }
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/tastings/:id/participants", ensureAuthenticated, async (req, res) => {
    try {
      const tastingId = parseInt(req.params.id);
      const tasting = await storage.getTasting(tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      const participants2 = await storage.getParticipantsByTasting(tastingId);
      const participantsWithUserInfo = await Promise.all(
        participants2.map(async (participant) => {
          const user = await storage.getUser(participant.userId);
          return {
            ...participant,
            user: user ? {
              id: user.id,
              name: user.name,
              email: user.email
            } : void 0
          };
        })
      );
      res.json(participantsWithUserInfo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/wines/:id/guess", ensureAuthenticated, async (req, res) => {
    try {
      const wineId = parseInt(req.params.id);
      const userId = req.user.id;
      const wine = await storage.getWineById(wineId);
      if (!wine) {
        return res.status(404).json({ error: "Wine not found" });
      }
      const flights3 = Array.from(await storage.getAllTastings()).flatMap(async (tasting2) => {
        return await storage.getFlightsByTasting(tasting2.id);
      });
      const flight = (await Promise.all(flights3)).flat().find((f) => f.id === wine.flightId);
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      if (!flight.startedAt || flight.completedAt) {
        return res.status(400).json({ error: "Flight is not active" });
      }
      const tasting = await storage.getTasting(flight.tastingId);
      if (!tasting) {
        return res.status(404).json({ error: "Tasting not found" });
      }
      const participant = await storage.getParticipant(tasting.id, userId);
      if (!participant) {
        return res.status(403).json({ error: "You are not a participant in this tasting" });
      }
      const guessData = insertGuessSchema.parse({
        ...req.body,
        participantId: participant.id,
        wineId
      });
      const guess = await storage.createGuess(guessData);
      res.status(201).json(guess);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });
  app2.get("/api/participants/:id/guesses", ensureAuthenticated, async (req, res) => {
    try {
      const participantId = parseInt(req.params.id);
      const participants2 = Array.from(await storage.getAllTastings()).flatMap(async (tasting2) => {
        return await storage.getParticipantsByTasting(tasting2.id);
      });
      const participant = (await Promise.all(participants2)).flat().find((p) => p.id === participantId);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      const userId = req.user.id;
      const tasting = await storage.getTasting(participant.tastingId);
      if (participant.userId !== userId && tasting?.hostId !== userId) {
        return res.status(403).json({ error: "You are not authorized to see these guesses" });
      }
      const guesses2 = await storage.getGuessesByParticipant(participantId);
      const guessesWithWineInfo = await Promise.all(
        guesses2.map(async (guess) => {
          const wine = await storage.getWineById(guess.wineId);
          return { ...guess, wine };
        })
      );
      res.json(guessesWithWineInfo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/wines/search", async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Invalid query" });
    }
    try {
      const results = await storage.searchWines(q);
      res.json(results);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });
  app2.get("/api/wines/all", async (req, res) => {
    try {
      const credentials = {
        username: process.env.VINATUREL_USERNAME || "verena.oleksyn@web.de",
        password: process.env.VINATUREL_PASSWORD || "Vinaturel123",
        apiKey: process.env.VINATUREL_API_KEY || "SWSCT5QYLV9K9CQMJ_XI1Q176W"
      };
      console.log("Fetching all wines from Vinaturel API");
      const wines2 = await VinaturelAPI.fetchWines(credentials);
      console.log(`Found ${wines2.length} wines from Vinaturel API`);
      return res.json(wines2);
    } catch (error) {
      console.error("Error fetching all wines:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/debug/db-check", async (req, res) => {
    try {
      const pool2 = new Pool3({ connectionString: process.env.DATABASE_URL });
      const pgResult = await pool2.query("SELECT 1+1 AS result");
      await pool2.end();
      const drizzleResult = await db.select().from(users).limit(1);
      res.json({
        pgConnection: pgResult.rows[0].result === 2 ? "OK" : "FEHLER",
        drizzleConnection: drizzleResult.length > 0 ? "OK" : "FEHLER",
        env: {
          DATABASE_URL: process.env.DATABASE_URL ? "gesetzt" : "nicht gesetzt",
          NODE_ENV: process.env.NODE_ENV
        }
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        stack: error.stack,
        rawError: error
      });
    }
  });
  const httpServer = createServer(app2);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/join" });
  wss.on("connection", async (socket, req) => {
    try {
      const query = req.url?.split("?")[1] || "";
      const params = new URLSearchParams(query);
      const tastingId = parseInt(params.get("t") || "", 10);
      if (!joinRooms.has(tastingId)) {
        joinRooms.set(tastingId, /* @__PURE__ */ new Set());
      }
      joinRooms.get(tastingId).add(socket);
      const participants2 = await storage.getParticipantsByTasting(tastingId);
      socket.send(JSON.stringify({ participants: participants2 }));
      socket.on("close", () => {
        joinRooms.get(tastingId).delete(socket);
      });
    } catch (err) {
      console.error("WebSocket connection error:", err);
    }
  });
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    server: {
      middlewareMode: true,
      hmr: {
        server,
        host: "localhost",
        port: 24679,
        protocol: "ws",
        clientPort: 24679
      },
      host: "0.0.0.0",
      allowedHosts: ["localhost", "127.0.0.1"],
      cors: {
        origin: true,
        credentials: true
      },
      fs: {
        strict: false
      }
    }
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
console.log("Arbeitsverzeichnis:", process.cwd());
console.log("DATABASE_URL:", process.env.DATABASE_URL);
var app = express2();
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use(
  session3({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1e3
      // 30 days
    }
  })
);
setupAuth(app);
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT, 10) || 4e3;
  server.listen(port, "0.0.0.0", () => {
    const addr = server.address();
    if (addr && typeof addr === "object") {
      log(`serving on http://${addr.address}:${addr.port}`);
    } else {
      log(`serving on port ${port}`);
    }
  });
})();
