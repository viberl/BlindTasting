import { pgTable, serial, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const vinaturelWines = pgTable('vinaturel_wines', {
  id: serial('id').primaryKey(),
  producer: text('producer').notNull(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  region: text('region').notNull(),
  vintage: integer('vintage').notNull(),
  varietals: jsonb('varietals').$type<string[]>().notNull().default([]),
  externalId: text('external_id').notNull().unique(),
  articleNumber: text('article_number'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export type VinaturelWine = typeof vinaturelWines.$inferSelect;
export type NewVinaturelWine = typeof vinaturelWines.$inferInsert;
