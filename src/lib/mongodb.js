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
      lastAttempt: null
    };
    globalThis.__mongoDiag = mongoDiag;
  }
  return mongoDiag;
}

export async function getDb() {
  const uri = process.env.MONGODB_URI;
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
    console.error('[MongoDB] Verbindung fehlgeschlagen -> Fallback (nur Message):', e.message);
    if (process.env.VERCEL) {
      console.error('[MongoDB] Stack Trace:', e.stack);
    }
    d.connectOk = false;
    d.lastError = e.message;
    d.lastAttempt = new Date().toISOString();
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
