"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vinaturelWines = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.vinaturelWines = (0, pg_core_1.pgTable)('vinaturel_wines', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    producer: (0, pg_core_1.text)('producer').notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    country: (0, pg_core_1.text)('country').notNull(),
    region: (0, pg_core_1.text)('region').notNull(),
    vintage: (0, pg_core_1.integer)('vintage').notNull(),
    varietals: (0, pg_core_1.jsonb)('varietals').$type().notNull().default([]),
    externalId: (0, pg_core_1.text)('external_id').notNull().unique(),
    articleNumber: (0, pg_core_1.text)('article_number'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
