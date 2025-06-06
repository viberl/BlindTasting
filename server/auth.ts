import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

// Erweitere die Session-Schnittstelle um benutzerdefinierte Eigenschaften
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    authenticated?: boolean;
  }
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // WICHTIG: Sehr einfache, direkte Session-Konfiguration für Entwicklung
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "blindsip-secret-key-dev-only",
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 Tage
      httpOnly: true,
      secure: false,
      path: '/',
      // Wir verwenden 'none' statt 'lax' für Entwicklung
      sameSite: 'none'
    }
  };
  
  console.log("Session secret is set:", !!process.env.SESSION_SECRET, "Store is set:", !!storage.sessionStore);

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password'
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
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
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Diese E-Mail-Adresse wird bereits verwendet" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      // Manuelles Login statt Passport
      // Setzen Sie die User-ID in die Session
      req.session.userId = user.id; 
      req.session.authenticated = true;
      console.log('Registrierung erfolgreich. Session-ID:', req.sessionID, 'User ID:', user.id);
      
      // Speichern Sie die Session, bevor Sie antworten
      req.session.save((err) => {
        if (err) {
          console.error('Session konnte nicht gespeichert werden:', err);
          return next(err);
        }
        
        // Stellen Sie sicher, dass Passport den Benutzer kennt
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error('Passport login fehlgeschlagen:', loginErr);
            return next(loginErr);
          }
          
          // Stelle sicher, dass alle Daten vor der Antwort geschrieben werden
          console.log('Session nach Speichern:', req.session);
          
          // Don't send the password back to the client
          const { password, ...userWithoutPassword } = user;
          res.status(201).json(userWithoutPassword);
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Anmeldung fehlgeschlagen" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Wir setzen eine Sitzungsvariable
        req.session.userId = (user as SelectUser).id;
        console.log('Login erfolgreich. Session-ID:', req.sessionID, 'User ID:', (user as SelectUser).id);
        
        // Session speichern, bevor wir antworten
        req.session.save((err) => {
          if (err) {
            console.error('Session konnte nicht gespeichert werden:', err);
            return next(err);
          }
          
          // Don't send the password back to the client
          const { password, ...userWithoutPassword } = user as SelectUser;
          res.json(userWithoutPassword);
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Temporäre Lösung: Direkter Endpunkt für Entwicklung, der direkt einen statischen Benutzer zurückgibt
  // Dieser Endpunkt ist nur für Testzwecke, sollte in der Produktion nicht verwendet werden
  app.get("/api/direct-check", async (req, res) => {
    console.log('Direct check aufgerufen mit Session:', req.sessionID);
    try {
      // Finden oder erstellen eines Test-Benutzers
      const user = await storage.getUser(1);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        return res.json({
          ...userWithoutPassword,
          _notice: "Direkte Authentifizierung - nur für Testzwecke"
        });
      } else {
        return res.status(404).json({ message: "Testbenutzer nicht gefunden" });
      }
    } catch (error) {
      console.error('Fehler bei direktem Test:', error);
      return res.status(500).json({ message: "Interner Serverfehler" });
    }
  });
  
  app.get("/api/user", async (req, res) => {
    // Debug-Informationen ausgeben
    console.log('GET /api/user - Session ID:', req.sessionID);
    console.log('Session Info:', {
      userId: req.session.userId,
      authenticated: req.session.authenticated,
      isAuthenticated: req.isAuthenticated()
    });
    
    // Wenn wir eine userId in der Session haben, versuchen wir den Benutzer zu finden
    // unabhängig vom Passport-Status
    if (req.session.userId) {
      try {
        const user = await storage.getUser(req.session.userId);
        
        if (user) {
          console.log('Benutzer aus Session-UserId gefunden:', user.id);
          const { password, ...userWithoutPassword } = user;
          return res.json(userWithoutPassword);
        }
      } catch (error) {
        console.error('Fehler beim Abrufen des Benutzers aus der Session:', error);
      }
    }
    
    // Passport Authentifizierung prüfen
    if (req.isAuthenticated()) {
      console.log('Benutzer ist über Passport authentifiziert');
      const { password, ...userWithoutPassword } = req.user as SelectUser;
      return res.json(userWithoutPassword);
    }
    
    // Wenn keine Authentifizierung vorliegt, 401 zurückgeben
    return res.status(401).json({ message: "Nicht authentifiziert" });
  });
}