console.log('Arbeitsverzeichnis:', process.cwd());
console.log('DATABASE_URL:', process.env.DATABASE_URL);

import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from 'cookie-parser';
import cors from "./cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { scheduleDailyVinaturelCsvImport } from "./jobs/vinaturel-csv-scheduler";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { importVinaturelFromCsv } from "./services/vinaturel-csv-importer";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Session-Konfiguration erfolgt zentral in setupAuth(app)

// Session- und Authentifizierungs-Middleware aktivieren
setupAuth(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "vinaturel_wines" (
        "id" serial PRIMARY KEY,
        "producer" text NOT NULL,
        "name" text NOT NULL,
        "country" text NOT NULL,
        "region" text NOT NULL,
        "vintage" integer NOT NULL,
        "varietals" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "external_id" text NOT NULL,
        "article_number" text,
        "product_url" text,
        "image_url" text,
        "volume_ml" integer,
        "varietal_1" text,
        "varietal_2" text,
        "varietal_3" text,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "vinaturel_wines_external_id_unique_idx"
      ON "vinaturel_wines" ("external_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_vinaturel_wines_article_number"
      ON "vinaturel_wines" ("article_number")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_vinaturel_wines_search"
      ON "vinaturel_wines" USING GIN (
        to_tsvector('german', coalesce("producer", '') || ' ' || coalesce("name", '') || ' ' || coalesce("region", '') || ' ' || coalesce("country", ''))
      )
    `);

    await db.execute(sql`ALTER TABLE "vinaturel_wines" ADD COLUMN IF NOT EXISTS "article_number" text`);
    await db.execute(sql`ALTER TABLE "vinaturel_wines" ADD COLUMN IF NOT EXISTS "product_url" text`);
    await db.execute(sql`ALTER TABLE "vinaturel_wines" ADD COLUMN IF NOT EXISTS "image_url" text`);
    await db.execute(sql`ALTER TABLE "vinaturel_wines" ADD COLUMN IF NOT EXISTS "volume_ml" integer`);
    await db.execute(sql`ALTER TABLE "vinaturel_wines" ADD COLUMN IF NOT EXISTS "varietal_1" text`);
    await db.execute(sql`ALTER TABLE "vinaturel_wines" ADD COLUMN IF NOT EXISTS "varietal_2" text`);
    await db.execute(sql`ALTER TABLE "vinaturel_wines" ADD COLUMN IF NOT EXISTS "varietal_3" text`);

    await db.execute(sql`ALTER TABLE "tastings" ADD COLUMN IF NOT EXISTS "show_rating_field" boolean DEFAULT true NOT NULL`);
    await db.execute(sql`ALTER TABLE "tastings" ADD COLUMN IF NOT EXISTS "show_notes_field" boolean DEFAULT true NOT NULL`);
    await db.execute(sql`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "review_approved_at" timestamp`);
    await db.execute(sql`ALTER TABLE "guesses" ADD COLUMN IF NOT EXISTS "override_score" integer`);
    await db.execute(sql`ALTER TABLE "guesses" ADD COLUMN IF NOT EXISTS "override_by" integer`);
    await db.execute(sql`ALTER TABLE "guesses" ADD COLUMN IF NOT EXISTS "override_reason" text`);
    await db.execute(sql`ALTER TABLE "guesses" ADD COLUMN IF NOT EXISTS "override_flags" json`);

    // Ensure cascades exist for dependent tables to allow tasting deletion in legacy DBs
    await db.execute(sql`ALTER TABLE "flights" DROP CONSTRAINT IF EXISTS "flights_tasting_id_tastings_id_fk"`);
    await db.execute(sql`ALTER TABLE "flights"
      ADD CONSTRAINT "flights_tasting_id_tastings_id_fk"
      FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION`);

    await db.execute(sql`ALTER TABLE "participants" DROP CONSTRAINT IF EXISTS "participants_tasting_id_tastings_id_fk"`);
    await db.execute(sql`ALTER TABLE "participants"
      ADD CONSTRAINT "participants_tasting_id_tastings_id_fk"
      FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION`);

    await db.execute(sql`ALTER TABLE "guesses" DROP CONSTRAINT IF EXISTS "guesses_participant_id_participants_id_fk"`);
    await db.execute(sql`ALTER TABLE "guesses"
      ADD CONSTRAINT "guesses_participant_id_participants_id_fk"
      FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION`);

    await db.execute(sql`ALTER TABLE "guesses" DROP CONSTRAINT IF EXISTS "guesses_wine_id_wines_id_fk"`);
    await db.execute(sql`ALTER TABLE "guesses"
      ADD CONSTRAINT "guesses_wine_id_wines_id_fk"
      FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION`);

    await db.execute(sql`ALTER TABLE "wines" DROP CONSTRAINT IF EXISTS "wines_flight_id_flights_id_fk"`);
    await db.execute(sql`ALTER TABLE "wines"
      ADD CONSTRAINT "wines_flight_id_flights_id_fk"
      FOREIGN KEY ("flight_id") REFERENCES "public"."flights"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION`);

    await db.execute(sql`ALTER TABLE "scoring_rules" DROP CONSTRAINT IF EXISTS "scoring_rules_tasting_id_tastings_id_fk"`);
    await db.execute(sql`ALTER TABLE "scoring_rules"
      ADD CONSTRAINT "scoring_rules_tasting_id_tastings_id_fk"
      FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION`);

    await db.execute(sql`ALTER TABLE "tasting_invitees" DROP CONSTRAINT IF EXISTS "tasting_invitees_tasting_id_tastings_id_fk"`);
    await db.execute(sql`ALTER TABLE "tasting_invitees"
      ADD CONSTRAINT "tasting_invitees_tasting_id_tastings_id_fk"
      FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION`);

    // Seed Vinaturel wines once via CSV import if the table is empty
    try {
      const wineCountResult = await db.execute(sql`SELECT COUNT(*)::int AS count FROM vinaturel_wines`);
      const wineCount = Number((wineCountResult.rows?.[0] as any)?.count ?? 0);
      if (wineCount === 0) {
        console.log('[Startup] vinaturel_wines table empty – running initial CSV import');
        const imported = await importVinaturelFromCsv();
        console.log(`[Startup] CSV import completed, processed ${imported} wines`);
      }
    } catch (importError) {
      console.error('[Startup] Failed to seed vinaturel_wines from CSV:', importError);
    }
  } catch (error) {
    console.error('Failed to ensure database schema consistency:', error);
  }

  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Vite setup for development
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on the specified PORT environment variable or default to 4000
  // This serves both the API and the client.
  const port = parseInt(process.env.PORT as string, 10) || 4000;
  // Remove reusePort for compatibility on macOS and other platforms
  // Listen on all interfaces (IPv4 & IPv6) to serve both API and client
  // Listen on all IPv4 interfaces to ensure localhost (127.0.0.1) is reachable
  server.listen(port, '0.0.0.0', () => {
    // Log the address and port for verification
    const addr = server.address();
    if (addr && typeof addr === 'object') {
      log(`serving on http://${addr.address}:${addr.port}`);
    } else {
      log(`serving on port ${port}`);
    }
  });

  // Schedule daily CSV import at 09:30 local time
  try {
    scheduleDailyVinaturelCsvImport(9, 30);
  } catch (e) {
    console.warn('Failed to schedule daily VINATUREL CSV import:', e);
  }
})();
