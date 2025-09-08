import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core';
import { tastings } from "../shared/schema";

export const vinaturelWines = pgTable('vinaturel_wines', {
  id: serial('id').primaryKey().notNull(),
  externalId: text('external_id').notNull().unique(),
  articleNumber: text('article_number'),
  producer: text('producer').notNull(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  region: text('region').notNull(),
  vintage: integer('vintage').notNull(),
  volumeMl: integer('volume_ml'),
  varietal1: text('varietal_1'),
  varietal2: text('varietal_2'),
  varietal3: text('varietal_3'),
  productUrl: text('product_url'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const tastingInvites = pgTable('tasting_invites', {
  id: serial('id').primaryKey().notNull(),
  tastingId: integer('tasting_id').notNull().references(() => tastings.id),
  email: text('email').notNull(),
  role: text('role').notNull().default('guest'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export type TastingInvite = typeof tastingInvites.$inferSelect;
export type InsertTastingInvite = typeof tastingInvites.$inferInsert;
