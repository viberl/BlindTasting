# BlindTasting

BlindTasting ist eine Fullstack-Anwendung zum Planen und Moderieren von Blindverkostungen. Hosts erstellen Verkostungen mit Flights, importieren Weine aus externen Quellen (Vinaturel/Shopware) und verfolgen die Ergebnisse der Teilnehmenden in Echtzeit. Teilnehmende reichen ihre Tipps über die Web-App ein und sehen Ranglisten, sobald Flights abgeschlossen sind.

## Highlights
- Verkostungen und Flights mit Zeitlimit, Statusverwaltung und sofortiger Auswertung
- Teilnehmermanagement inkl. Einladungen, Passwortschutz und öffentlichen Sessions
- Echtzeit-Statistiken, Leaderboards und detaillierte Guess-Auswertungen (WebSockets)
- Weinverwaltung mit Vinaturel-Suche, CSV-/Shopware-Import und eigenen Vorschlägen
- Session-basierte Authentifizierung (Passport.js) und Berechtigungsschutz für API-Routen

## Technischer Überblick
- **Client:** React 18, Vite, Tailwind CSS, Radix UI, TanStack Query, Wouter
- **Server:** Express, Passport.js, Drizzle ORM, WebSocket-Server, cron-Job Scheduler
- **Datenbank:** PostgreSQL mit Drizzle-Migrationen
- **Code-Sharing:** `shared/` enthält Typschemata für Client und Server

## Verzeichnisstruktur
- `client/` – Frontend (React + Vite)
- `server/` – Backend (Express, Auth, WebSocket, Jobs, Scripts)
- `shared/` – geteilte Drizzle-Schemata und Typen
- `drizzle/` – generierte SQL-Migrationen
- `dist/` – Build-Artefakte für Produktion (`npm run build`)

## Voraussetzungen
- Node.js ≥ 20 und npm
- PostgreSQL (lokal oder gehostet)
- Zugriff auf Vinaturel-/Shopware-Schnittstellen, falls Importe genutzt werden sollen

## Schnellstart
1. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
2. `.env` anlegen (siehe Beispiel unten) und `DATABASE_URL` auf eine erreichbare PostgreSQL-Instanz setzen.
3. Datenbanktabellen bereitstellen (legt Schema an bzw. synchronisiert Änderungen):
   ```bash
   npm run db:push
   ```
4. Optional: Vinaturel CSV-Daten importieren, falls `VINATUREL_EXPORT_URL` gesetzt ist:
   ```bash
   npm run db:import-vinaturel-csv
   ```
5. Entwicklungsserver starten (API + Vite Dev-Server laufen im gleichen Prozess):
   ```bash
   npm run dev
   ```
   Die Anwendung ist anschließend unter `http://localhost:4000` erreichbar.

Um "Eigene Weine" wieder aus der Datenbank zu löschen: DELETE /api/wine-suggestions/custom?confirm=true

## Umgebungskonfiguration
Erstelle eine `.env` im Projektstamm. Wichtige Variablen:

| Variable | Pflicht | Beschreibung | Beispiel |
|----------|---------|--------------|----------|
| `DATABASE_URL` | Ja | PostgreSQL-Verbindungsstring | `postgresql://postgres:postgres@localhost:5432/blindtasting` |
| `SESSION_SECRET` | Ja | Secret für Express-Session/Passport | `super-secret-string` |
| `PORT` | Nein | Port für API & Client (Default 4000) | `4000` |
| `VINATUREL_EXPORT_URL` | Optional | CSV-Export (wird beim Start für Seed genutzt) | `https://.../vinaturel.csv` |
| `VINATUREL_API_KEY` | Optional | API-Key für direkte Vinaturel-API-Abfragen | `abc123` |
| `VINATUREL_USERNAME` / `VINATUREL_PASSWORD` | Optional | Zugangsdaten für Legacy-Endpunkte | – |
| `SHOPWARE_API_URL` | Optional | Shopware Store-API Basis-URL | `https://shop.example.com` |
| `SHOPWARE_ACCESS_KEY` | Optional | Access-Key für Shopware Store-API | `XXXX` |

Weitere Umgebungsvariablen (z. B. für Remote-Datenbanken) können je nach Deploy-Ziel ergänzt werden. Der Server lädt `dotenv` automatisch.

## Nützliche npm-Skripte
| Skript | Zweck |
|--------|-------|
| `npm run dev` | Startet Express + Vite im Entwicklungsmodus (Hot Reloading) |
| `npm run build` | Erstellt Produktionsbuild (`client` via Vite, `server` via esbuild) |
| `npm start` | Führt Migrationen aus und startet den kompilierten Produktionsserver |
| `npm run check` | TypeScript-Typprüfung |
| `npm run db:push` | Synct Schema mit der Datenbank (Drizzle Push) |
| `npm run db:migrate` | Führt Migrationen aus (`drizzle-kit migrate`) |
| `npm run db:import-vinaturel-csv` | Importiert Vinaturel-Daten aus CSV (`VINATUREL_EXPORT_URL`) |
| `npm run db:import-wines` | Importiert Weine via Vinaturel-API (API-Key erforderlich) |
| `npm run db:check-vinaturel` | Validiert das `vinaturel_wines`-Schema |

Zusätzliche Skripte im Ordner `server/scripts/` unterstützen Spezialaufgaben (z. B. Shopware-Import, Schema-Prüfungen). Die Skripte erwarten, dass `DATABASE_URL` gesetzt ist, und können mit `tsx` gestartet werden, z. B. `npx tsx server/scripts/import-vinaturel-wines.ts`.

## Datenbank & Importe
- Beim Server-Start wird das `vinaturel_wines`-Schema angelegt und – sofern leer – einmalig per CSV befüllt (`VINATUREL_EXPORT_URL`).
- Ein Cron-Job (über `scheduleDailyVinaturelCsvImport`) startet täglich um 09:30 Uhr einen CSV-Import. Stelle sicher, dass der Host Zugriff auf die Datei hat.
- Individuelle Weinvorschläge werden in `custom_wine_suggestions` gespeichert. Zum Zurücksetzen:
  ```http
  DELETE /api/wine-suggestions/custom?confirm=true
  ```

## Entwicklungs-Workflows
- **Authentifizierung:** In `NODE_ENV=development` legt der Server automatisch einen Testuser an und deaktiviert Auth-Zwang, um UI-Tests zu erleichtern.
- **WebSocket-Events:** Live-Updates für Leaderboards/Flights nutzen `ws`. Achte darauf, dass Proxies (z. B. in Produktion) WebSocket-Verbindungen weiterleiten.
- **Styling:** Tailwind-Utility-Klassen + Radix-Primitives. `tailwind.config.ts` und `theme.json` steuern das Design.

## Deployment-Hinweise
1. Produktionsartefakte bauen: `npm run build`
2. Envs setzen (`DATABASE_URL`, `SESSION_SECRET`, optionale API-Keys)
3. Server starten: `npm start`
   - `npm start` führt `db:migrate` aus, bevor `dist/index.js` gestartet wird.
4. Stelle sicher, dass ein Scheduler (oder manueller Cron) für den täglichen CSV-Import läuft, falls benötigt.

## Lizenz
MIT-Lizenz. Siehe `package.json`.
