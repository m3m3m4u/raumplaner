// Optionaler MongoDB Connector mit globalem Cache
// Nutzung nur wenn MONGODB_URI / MONGODB_DB gesetzt – sonst Rückfall auf lokale JSON-Dateien
import { MongoClient } from 'mongodb';

let cachedClient = globalThis.__mongoClient;
let cachedDb = globalThis.__mongoDb;
let mongoDiag = globalThis.__mongoDiag;

function initDiag() {
  if (!mongoDiag) {
    mongoDiag = {
      envPresent: false,
      sanitizedUri: null,
      dbName: null,
      connectOk: false,
      lastError: null,
  lastErrorCode: null,
  lastStack: null,
  lastAttempt: null,
  fallbackTried: false,
  fallbackOk: false
    };
    globalThis.__mongoDiag = mongoDiag;
  }
  return mongoDiag;
}

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  const fallbackUri = process.env.MONGODB_URI_FALLBACK; // optional alternative (nicht SRV z.B.)
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    const d = initDiag();
    d.envPresent = false;
    d.lastError = 'Missing URI or DB name';
    d.lastAttempt = new Date().toISOString();
    return null;
  }
  const d = initDiag();
  d.envPresent = true;
  d.dbName = dbName;
  d.sanitizedUri = uri.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');
  d.lastAttempt = new Date().toISOString();
  try {
    if (!cachedClient || !cachedDb) {
  const client = new MongoClient(uri, { maxPoolSize: 10 });
      await client.connect();
      cachedClient = client;
      cachedDb = client.db(dbName);
      globalThis.__mongoClient = cachedClient;
      globalThis.__mongoDb = cachedDb;
      await ensureCounter(cachedDb, 'rooms');
      await ensureCounter(cachedDb, 'reservations');
      await ensureIndexes(cachedDb);
      d.connectOk = true;
      d.lastError = null;
    }
    return cachedDb;
  } catch (e) {
    console.error('[MongoDB] Verbindung fehlgeschlagen (primary URI):', e.message);
    if (process.env.VERCEL) {
      console.error('[MongoDB] Stack Trace:', e.stack);
    }
    d.connectOk = false;
    d.lastError = e.message;
    d.lastErrorCode = e.code || null;
    d.lastStack = e.stack || null;
    d.lastAttempt = new Date().toISOString();

    // Versuch mit Fallback URI (falls gesetzt)
    if (fallbackUri && !d.fallbackTried) {
      d.fallbackTried = true;
      try {
        const client2 = new MongoClient(fallbackUri, { maxPoolSize: 10 });
        await client2.connect();
        cachedClient = client2;
        cachedDb = client2.db(process.env.MONGODB_DB);
        globalThis.__mongoClient = cachedClient;
        globalThis.__mongoDb = cachedDb;
        await ensureCounter(cachedDb, 'rooms');
        await ensureCounter(cachedDb, 'reservations');
        await ensureIndexes(cachedDb);
        d.fallbackOk = true;
        return cachedDb;
      } catch (e2) {
        console.error('[MongoDB] Fallback URI ebenfalls fehlgeschlagen:', e2.message);
        if (process.env.VERCEL) console.error('[MongoDB] Fallback Stack:', e2.stack);
        d.fallbackOk = false;
        d.lastStack = (d.lastStack || '') + '\n--- Fallback ---\n' + (e2.stack || e2.message);
      }
    }
    return null;
  }
}

async function ensureCounter(db, name) {
  const counters = db.collection('counters');
  const existing = await counters.findOne({ _id: name });
  if (!existing) await counters.insertOne({ _id: name, seq: 0 });
}

export async function getNextSequence(db, name) {
  const counters = db.collection('counters');
  const result = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return result.seq || result.value?.seq || 1;
}

async function ensureIndexes(db) {
  try {
    const rooms = db.collection('rooms');
    const reservations = db.collection('reservations');
    const schedule = db.collection('schedule');
    // Uniqueness on numeric id fields (application-level ids)
    await rooms.createIndex({ id: 1 }, { unique: true }).catch(() => {});
    await reservations.createIndex({ id: 1 }, { unique: true }).catch(() => {});
    await schedule.createIndex({ id: 1 }, { unique: true }).catch(() => {});
    // Query performance indices
    await reservations.createIndex({ roomId: 1, date: 1, startTime: 1 }).catch(() => {});
  } catch (err) {
    console.warn('Index-Erstellung übersprungen:', err.message);
  }
}
