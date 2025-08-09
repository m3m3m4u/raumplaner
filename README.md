# Raumreservierungs-System

Eine moderne Web-Anwendung zur Verwaltung von Raumreservierungen, entwickelt mit Next.js 15 und MongoDB Atlas.

## ✨ Features

- **Raumverwaltung**: Erstellen, bearbeiten und löschen von Räumen
- **Reservierungssystem**: Intuitive Buchung mit Konfliktprüfung
- **Zeitplan-Management**: Konfigurierbare Stundenzeiten
- **Responsive Design**: Optimiert für alle Geräte
- **Datenbank-Integration**: Vollständige MongoDB Atlas Integration

## 🚀 Vercel Deployment

### 1. Vercel Setup

1. Repository zu Vercel verbinden
2. Import your Git Repository
3. Deploy Settings konfigurieren

### 2. Environment Variables in Vercel

Gehen Sie zu Vercel Dashboard → Ihr Projekt → Settings → Environment Variables und fügen Sie hinzu:

```
MONGODB_URI=mongodb+srv://schuleamsee:Seestraße58@raumreservierung.3f4resv.mongodb.net/
MONGODB_DB=raumreservierung
```

### 3. Deploy

Nach dem Setup deployt Vercel automatisch bei jedem Push zum main Branch.

## 🔧 Lokale Entwicklung

### Voraussetzungen

- Node.js 18+ 
- MongoDB Atlas Account

### Installation

1. Repository klonen:
```bash
git clone <repository-url>
cd raumplan
```

2. Dependencies installieren:
```bash
npm install
```

3. Environment Variables konfigurieren:
```bash
cp .env.example .env.local
```

Editieren Sie `.env.local` mit Ihren MongoDB-Credentials:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=raumreservierung
```

4. Entwicklungsserver starten:
```bash
npm run dev
```

Die Anwendung ist verfügbar unter: http://localhost:3000

## 📊 MongoDB Atlas Setup

### 1. Cluster erstellen

1. Bei MongoDB Atlas anmelden
2. Neues Projekt erstellen
3. Cluster erstellen (kostenloser M0 Tier verfügbar)

### 2. Netzwerk-Zugriff konfigurieren

1. Network Access → Add IP Address
2. Für Vercel: "Allow access from anywhere" (0.0.0.0/0)
3. Für lokale Entwicklung: Ihre aktuelle IP hinzufügen

### 3. Database User erstellen

1. Database Access → Add New Database User
2. Username und Passwort festlegen
3. Read and write to any database Berechtigung

### 4. Connection String erhalten

1. Clusters → Connect → Connect your application
2. Node.js Driver auswählen
3. Connection String kopieren und in `.env.local` einfügen

## 🗄️ Datenmodell

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

## 🛠️ API Endpoints

### Räume
- `GET /api/rooms` - Alle Räume abrufen
- `POST /api/rooms` - Neuen Raum erstellen
- `PUT /api/rooms` - Raum aktualisieren
- `DELETE /api/rooms?id={id}` - Raum löschen

### Reservierungen
- `GET /api/reservations` - Alle Reservierungen abrufen
- `POST /api/reservations` - Neue Reservierung erstellen
- `PUT /api/reservations` - Reservierung aktualisieren
- `DELETE /api/reservations?id={id}` - Reservierung löschen

### Schedule
- `GET /api/schedule` - Stundenplan abrufen
- `POST /api/schedule` - Neue Stunde hinzufügen
- `PUT /api/schedule` - Stunde aktualisieren
- `DELETE /api/schedule?id={id}` - Stunde löschen

### Utilities
- `GET /api/test-db` - Datenbankverbindung testen
- `POST /api/migrate` - JSON-Daten zu MongoDB migrieren

## 📱 Technologie-Stack

- **Frontend**: Next.js 15, React Context API
- **Backend**: Next.js API Routes
- **Datenbank**: MongoDB Atlas
- **Deployment**: Vercel
- **Styling**: CSS Modules

## 🔐 Sicherheit

- Environment Variables für sensible Daten
- MongoDB Connection Pooling
- Input Validierung in API Routes
- Konfliktprüfung für Reservierungen

## 📈 Performance

- Global MongoDB Connection Caching
- Optimierte Datenbankabfragen
- Client-seitige State Management
- Responsive Design für alle Geräte

## 🚧 Produktions-Deployment

Die Anwendung ist vollständig für Vercel konfiguriert:

1. ✅ MongoDB-only Persistierung
2. ✅ Environment Variables Setup
3. ✅ Optimierte API Routes
4. ✅ Connection Pooling
5. ✅ Error Handling

Nach dem Deployment werden alle Daten ausschließlich in MongoDB Atlas gespeichert - keine lokalen JSON-Dateien mehr.
