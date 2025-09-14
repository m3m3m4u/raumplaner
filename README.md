# Raumplaner

Modernes, responsives Raum- & Reservierungstool auf Basis von Next.js (App Router) + MongoDB.

## Features
- Räume verwalten (Name, Beschreibung, Ausstattung, Kapazität, Location)
- Stundenplan / Zeitraster verwalten
- Freie Räume nach Stunden suchen
- Reservierungen (inkl. Serientermine) mit Konfliktprüfung
- Fallback auf Initialdaten wenn DB nicht erreichbar (Mutationen liefern 503)

## Lokale Entwicklung
```bash
npm install
npm run dev
```

Hinweise:

- Es gibt keine hartkodierten Räume/Reservierungen/Zeitraster mehr – alles kommt aus der Datenbank.
- Das Zeitraster (Collection `schedule`) pflegen Sie per API (`/api/schedule`) oder einmalig per Skript:

```powershell
node .\update-schedule.js
```

Damit werden bestehende Perioden ersetzt und das aktuelle Schulraster (inkl. 4. Stunde ab 10:55) eingetragen.
```
http://localhost:3000

.env.local Beispiel:
```
MONGODB_URI=mongodb+srv://schuleamsee:Seestra%C3%9Fe58@raumreservierung.3f4resv.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=raumreservierung
```
Hinweis: Sonderzeichen (z.B. ß) URL-encoden (ß -> %C3%9F).

## Deployment nach Vercel
1. GitHub Repo importieren
2. In Project Settings → Environment Variables (Production + Preview) setzen:
   - MONGODB_URI
   - MONGODB_DB
3. Deploy auslösen (Push auf main reicht)
4. Test: https://<dein-project>.vercel.app/api/test-db → sollte `{ "ok": true }` liefern.

## Troubleshooting MongoDB
- TLS alert 80: Passwort falsch encodiert oder Netzwerk/Proxy blockiert TLS.
- Test lokal: `node test-mongodb.js` (Script mit gleicher URI).
- DNS prüfen: `nslookup raumreservierung.3f4resv.mongodb.net` sollte SRV Einträge liefern.
- Falls Schulnetz: kurz über mobilen Hotspot testen.

## Datenmodell (vereinfachte Felder)

### Collections

#### rooms
```javascript
{
  id: Number,
  name: String,
  capacity: Number,
  equipment: [String],
  location: String,
  description: String,
  createdAt: String,
  updatedAt: String
}
```

#### reservations
```javascript
{
  id: Number,
  roomId: Number,
  title: String,
  description: String,
  date: String, // YYYY-MM-DD
  startTime: String, // HH:MM
  endTime: String, // HH:MM
  createdBy: String,
  createdAt: String,
  updatedAt: String
}
```

#### schedule
```javascript
{
  id: Number,
  name: String, // "1. Stunde"
  startTime: String, // "08:00"
  endTime: String // "08:50"
}
```

## API Endpoints (Kurz)
- GET/POST/PUT/DELETE /api/rooms
- GET/POST/PUT/DELETE /api/reservations
- GET/POST/PUT/DELETE /api/schedule
- GET /api/test-db (Verbindungscheck)
- POST /api/migrate (Migration initialer Daten)

## Nächste Schritte / Ideen
- Indizes anlegen (rooms.id, reservations.roomId+date)
- Auth / Rollen
- Persistenten Schedule nach erster DB-Verbindung speichern
- Rate Limiting / Logging

Interner Gebrauch.
