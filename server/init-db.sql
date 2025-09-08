-- Tabelle für Benutzer
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL
);

-- Tabelle für Tastings
CREATE TABLE IF NOT EXISTS tastings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hostId INTEGER NOT NULL,
  isPublic BOOLEAN DEFAULT 0,
  password TEXT,
  status TEXT DEFAULT 'draft',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME,
  FOREIGN KEY (hostId) REFERENCES users(id)
);

-- Beispielbenutzer
INSERT INTO users (name, email) VALUES ('Test Host', 'test@example.com');

-- Beispiel-Tastings (verschiedene Typen)
INSERT INTO tastings (name, hostId, isPublic, status) VALUES ('Mein privates Tasting', 1, 0, 'draft');
INSERT INTO tastings (name, hostId, isPublic, status) VALUES ('Mein öffentliches Tasting', 1, 1, 'active');
INSERT INTO tastings (name, hostId, isPublic, password, status) VALUES ('Mein passwortgeschütztes Tasting', 1, 0, 'geheim', 'active');

-- Weitere Tabellen (Platzhalter, falls benötigt)
-- CREATE TABLE IF NOT EXISTS participants (...);
-- CREATE TABLE IF NOT EXISTS flights (...);
-- CREATE TABLE IF NOT EXISTS wines (...);
-- CREATE TABLE IF NOT EXISTS guesses (...);
-- CREATE TABLE IF NOT EXISTS scoringRules (...);
