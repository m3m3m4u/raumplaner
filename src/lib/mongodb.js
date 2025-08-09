// Optionaler MongoDB Connector mit globalem Cache
// Nutzung nur wenn MONGODB_URI / MONGODB_DB gesetzt – sonst Rückfall auf lokale JSON-Dateien
import { MongoClient } from 'mongodb';

let cachedClient = globalThis.__mongoClient;
let cachedDb = globalThis.__mongoDb;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) return null;
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
    }
    return cachedDb;
  } catch (e) {
    console.error('MongoDB Verbindung fehlgeschlagen, Fallback Filesystem:', e.message);
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
