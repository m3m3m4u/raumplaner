#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getDb } from './src/lib/mongodb.js';

async function run() {
  console.log('Lade Umgebungsvariablen...');
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI nicht gesetzt (aus .env.local). Abbruch.');
    process.exit(1);
  }
  const db = await getDb();
  if (!db) {
    console.error('Keine DB Verbindung. Prüfe MONGODB_URI und MONGODB_DB.');
    process.exit(1);
  }
  const reservationsCol = db.collection('reservations');
  const countersCol = db.collection('counters');

  const countBefore = await reservationsCol.countDocuments();
  const delResult = await reservationsCol.deleteMany({});

  // Counter optional zurücksetzen
  await countersCol.updateOne({ _id: 'reservations' }, { $set: { seq: 0 } }, { upsert: true });

  console.log(`Gelöscht: ${delResult.deletedCount} Reservierungen (vorher ${countBefore}).`);
  console.log('Counter für reservations auf 0 gesetzt.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
