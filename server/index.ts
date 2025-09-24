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
    await db.execute(sql`ALTER TABLE "tastings" ADD COLUMN IF NOT EXISTS "show_rating_field" boolean DEFAULT true NOT NULL`);
    await db.execute(sql`ALTER TABLE "tastings" ADD COLUMN IF NOT EXISTS "show_notes_field" boolean DEFAULT true NOT NULL`);
    await db.execute(sql`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "review_approved_at" timestamp`);
    await db.execute(sql`ALTER TABLE "guesses" ADD COLUMN IF NOT EXISTS "override_score" integer`);
    await db.execute(sql`ALTER TABLE "guesses" ADD COLUMN IF NOT EXISTS "override_by" integer`);
    await db.execute(sql`ALTER TABLE "guesses" ADD COLUMN IF NOT EXISTS "override_reason" text`);
    await db.execute(sql`ALTER TABLE "guesses" ADD COLUMN IF NOT EXISTS "override_flags" json`);
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
