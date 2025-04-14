import { pgTable, text, serial, integer, boolean, timestamp, json, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Tastings
export const tastings = pgTable("tastings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hostId: integer("host_id").notNull().references(() => users.id),
  isPublic: boolean("is_public").default(true).notNull(),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").default("draft").notNull(), // draft, active, completed
});

export const insertTastingSchema = createInsertSchema(tastings).pick({
  name: true,
  hostId: true,
  isPublic: true,
  password: true,
});

export type InsertTasting = z.infer<typeof insertTastingSchema>;
export type Tasting = typeof tastings.$inferSelect;

// Tasting Invitees
export const tastingInvitees = pgTable("tasting_invitees", {
  tastingId: integer("tasting_id").notNull().references(() => tastings.id),
  email: text("email").notNull(),
}, (t) => ({
  pk: primaryKey(t.tastingId, t.email),
}));

export const insertTastingInviteeSchema = createInsertSchema(tastingInvitees);
export type InsertTastingInvitee = z.infer<typeof insertTastingInviteeSchema>;
export type TastingInvitee = typeof tastingInvitees.$inferSelect;

// Scoring Rules
export const scoringRules = pgTable("scoring_rules", {
  id: serial("id").primaryKey(),
  tastingId: integer("tasting_id").notNull().references(() => tastings.id),
  country: integer("country").default(0).notNull(),
  region: integer("region").default(0).notNull(),
  producer: integer("producer").default(0).notNull(),
  wineName: integer("wine_name").default(0).notNull(),
  vintage: integer("vintage").default(0).notNull(),
  varietals: integer("varietals").default(0).notNull(),
  anyVarietalPoint: boolean("any_varietal_point").default(false).notNull(),
  displayCount: integer("display_count"),
});

export const insertScoringRuleSchema = createInsertSchema(scoringRules).pick({
  tastingId: true,
  country: true,
  region: true,
  producer: true,
  wineName: true,
  vintage: true,
  varietals: true,
  anyVarietalPoint: true,
  displayCount: true,
});

export type InsertScoringRule = z.infer<typeof insertScoringRuleSchema>;
export type ScoringRule = typeof scoringRules.$inferSelect;

// Flights
export const flights = pgTable("flights", {
  id: serial("id").primaryKey(),
  tastingId: integer("tasting_id").notNull().references(() => tastings.id),
  name: text("name").notNull(),
  orderIndex: integer("order_index").notNull(),
  timeLimit: integer("time_limit").default(600).notNull(), // in seconds
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertFlightSchema = createInsertSchema(flights).pick({
  tastingId: true,
  name: true,
  orderIndex: true,
  timeLimit: true,
});

export type InsertFlight = z.infer<typeof insertFlightSchema>;
export type Flight = typeof flights.$inferSelect;

// Wines
export const wines = pgTable("wines", {
  id: serial("id").primaryKey(),
  flightId: integer("flight_id").notNull().references(() => flights.id),
  letterCode: text("letter_code").notNull(), // A, B, C, etc.
  country: text("country").notNull(),
  region: text("region").notNull(),
  producer: text("producer").notNull(),
  name: text("name").notNull(),
  vintage: text("vintage").notNull(),
  varietals: text("varietals").array().notNull(),
  vinaturelId: text("vinaturel_id"),
  isCustom: boolean("is_custom").default(false).notNull(),
});

export const insertWineSchema = createInsertSchema(wines).pick({
  flightId: true,
  letterCode: true,
  country: true,
  region: true,
  producer: true,
  name: true,
  vintage: true,
  varietals: true,
  vinaturelId: true,
  isCustom: true,
});

export type InsertWine = z.infer<typeof insertWineSchema>;
export type Wine = typeof wines.$inferSelect;

// Participants
export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  tastingId: integer("tasting_id").notNull().references(() => tastings.id),
  userId: integer("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  score: integer("score").default(0).notNull(),
});

export const insertParticipantSchema = createInsertSchema(participants).pick({
  tastingId: true,
  userId: true,
});

export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participants.$inferSelect;

// Guesses
export const guesses = pgTable("guesses", {
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
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertGuessSchema = createInsertSchema(guesses).pick({
  participantId: true,
  wineId: true,
  country: true,
  region: true,
  producer: true,
  name: true,
  vintage: true,
  varietals: true,
  rating: true,
  notes: true,
});

export type InsertGuess = z.infer<typeof insertGuessSchema>;
export type Guess = typeof guesses.$inferSelect;
