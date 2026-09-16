#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import crypto from 'crypto';
import { getDb, getNextSequence } from '../src/lib/mongodb.js';

// Argumente parsen
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--dry');

const ADMIN_PASSWORD_HASH = '1a612f9978510d19e0ef76c0db38f03f9ed5267d643d0a606fa4c179573344b9'; // sha256('872020')

// 14 Termine laut Stundenplan-Bild für den Musikraum (Raum 5)
// Startdaten für Woche 1 (Schuljahresbeginn Vorarlberg 2026/2027: Mo 14.09.2026):
// Montag: 2026-09-14, Dienstag: 2026-09-15, Mittwoch: 2026-09-16, Donnerstag: 2026-09-17, Freitag: 2026-09-18
const SLOTS = [
  // Montag
  { day: 'Montag', baseDate: [2026, 9, 14], hourName: '1.', startTime: [8, 0], endTime: [8, 50], title: 'B1' },

  // Dienstag
  { day: 'Dienstag', baseDate: [2026, 9, 15], hourName: '1.', startTime: [8, 0], endTime: [8, 50], title: 'B1' },
  { day: 'Dienstag', baseDate: [2026, 9, 15], hourName: '2.', startTime: [8, 50], endTime: [9, 40], title: 'C12' },
  { day: 'Dienstag', baseDate: [2026, 9, 15], hourName: '5.', startTime: [11, 45], endTime: [12, 40], title: 'C11' },

  // Mittwoch
  { day: 'Mittwoch', baseDate: [2026, 9, 16], hourName: '1.', startTime: [8, 0], endTime: [8, 50], title: 'B2/C2' },
  { day: 'Mittwoch', baseDate: [2026, 9, 16], hourName: '2.', startTime: [8, 50], endTime: [9, 40], title: 'B2' },
  { day: 'Mittwoch', baseDate: [2026, 9, 16], hourName: '3.', startTime: [9, 45], endTime: [10, 35], title: 'C2' },
  { day: 'Mittwoch', baseDate: [2026, 9, 16], hourName: '4.', startTime: [10, 55], endTime: [11, 45], title: 'C13' },
  { day: 'Mittwoch', baseDate: [2026, 9, 16], hourName: '5.', startTime: [11, 45], endTime: [12, 40], title: 'A21' },

  // Donnerstag
  { day: 'Donnerstag', baseDate: [2026, 9, 17], hourName: '1.', startTime: [8, 0], endTime: [8, 50], title: 'B1/ C0' },
  { day: 'Donnerstag', baseDate: [2026, 9, 17], hourName: '2.', startTime: [8, 50], endTime: [9, 40], title: 'A1' },
  { day: 'Donnerstag', baseDate: [2026, 9, 17], hourName: '3.', startTime: [9, 45], endTime: [10, 35], title: 'A22' },
  { day: 'Donnerstag', baseDate: [2026, 9, 17], hourName: '5.', startTime: [11, 45], endTime: [12, 40], title: 'C2' },

  // Freitag
  { day: 'Freitag', baseDate: [2026, 9, 18], hourName: '3.', startTime: [9, 45], endTime: [10, 35], title: 'A23' }
];

const WEEKS_TOTAL = 43;
const ROOM_ID = 5;

function formatDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function run() {
  console.log(`[reserve-musik] Starte Schuljahr-Buchung (Dry-Run: ${isDryRun ? 'JA' : 'NEIN'})...`);

  const db = await getDb();
  if (!db) {
    console.error('Keine MongoDB-Verbindung hergestellt.');
    process.exit(1);
  }

  const roomsCol = db.collection('rooms');
  const reservationsCol = db.collection('reservations');

  const room = await roomsCol.findOne({ id: ROOM_ID });
  if (!room) {
    console.error(`Raum mit ID ${ROOM_ID} nicht gefunden!`);
    process.exit(1);
  }
  console.log(`Zielraum: ${room.name} (ID ${ROOM_ID}, ${room.location || 'k.A.'})`);

  // 1. Alte Serie "Instrumentenkarusell A.1" bereinigen
  const karusellQuery = {
    roomId: ROOM_ID,
    seriesId: '830049a1-aad6-49f8-b993-05acac9e81b1'
  };
  const karusellCount = await reservationsCol.countDocuments(karusellQuery);
  console.log(`Gefundene alte Karusell-Buchungen am Donnerstag: ${karusellCount}`);

  if (!isDryRun && karusellCount > 0) {
    const delRes = await reservationsCol.deleteMany(karusellQuery);
    console.log(`Gelöscht: ${delRes.deletedCount} alte Karusell-Buchungen.`);
  }

  // 2. Erzeuge 14 Serien über jeweils 43 Wochen
  const allDocs = [];
  const now = new Date().toISOString();

  for (const slot of SLOTS) {
    const seriesId = crypto.randomUUID();
    const [bY, bM, bD] = slot.baseDate;

    for (let week = 1; week <= WEEKS_TOTAL; week++) {
      // Datum der jeweiligen Woche berechnen
      const targetDate = new Date(bY, bM - 1, bD + (week - 1) * 7);
      const dateStr = formatDateOnly(targetDate);

      // Start- und Endzeit als lokales Datum aufbauen und zu ISO konvertieren
      const startDt = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), slot.startTime[0], slot.startTime[1], 0, 0);
      const endDt = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), slot.endTime[0], slot.endTime[1], 0, 0);

      const title = `${slot.title} (Woche ${week}/${WEEKS_TOTAL})`;

      const doc = {
        roomId: ROOM_ID,
        title,
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
        organizer: 'System',
        attendees: 0,
        description: '',
        requireDeletionPassword: true,
        deletionPassword: '',
        deletionPasswordHash: ADMIN_PASSWORD_HASH,
        seriesId,
        seriesIndex: week,
        seriesTotal: WEEKS_TOTAL,
        date: dateStr,
        createdAt: now,
        updatedAt: now
      };

      allDocs.push(doc);
    }
  }

  console.log(`Insgesamt generierte Reservierungsdokumente: ${allDocs.length} (14 Slots * ${WEEKS_TOTAL} Wochen)`);

  // Konfliktprüfung im Batch
  console.log('Führe Konfliktprüfung durch...');
  const existingDocs = await reservationsCol.find({
    roomId: ROOM_ID,
    date: { $gte: '2026-09-14', $lte: '2027-07-09' }
  }).toArray();

  console.log(`Vorhandene Reservierungen im Musikraum im Zeitraum: ${existingDocs.length}`);
  let conflictCount = 0;
  for (const doc of allDocs) {
    const dStart = new Date(doc.startTime).getTime();
    const dEnd = new Date(doc.endTime).getTime();
    const conflict = existingDocs.find(ex => {
      if (ex.date !== doc.date) return false;
      const exStart = new Date(ex.startTime).getTime();
      const exEnd = new Date(ex.endTime).getTime();
      return exStart < dEnd && exEnd > dStart;
    });
    if (conflict) {
      console.warn(`[KONFLIKT] ${doc.date}: ${doc.title} (${doc.startTime}) überschneidet sich mit "${conflict.title}" (${conflict.startTime})`);
      conflictCount++;
    }
  }

  if (conflictCount > 0) {
    console.error(`Es wurden ${conflictCount} Konflikte gefunden!`);
    if (!isDryRun) {
      process.exit(1);
    }
  } else {
    console.log('Keine Konflikte gefunden. Alle Buchungen sind überschneidungsfrei!');
  }

  if (isDryRun) {
    console.log('[Dry-Run beendet] Keine Änderungen in der Datenbank gespeichert.');
    return;
  }

  // IDs vergeben und speichern
  console.log('Vergebe IDs und speichere Dokumente in der Datenbank...');
  for (const doc of allDocs) {
    doc.id = await getNextSequence(db, 'reservations');
  }

  const insertRes = await reservationsCol.insertMany(allDocs, { ordered: true });
  console.log(`Erfolgreich ${insertRes.insertedCount} Reservierungen angelegt!`);

  console.log('Fertig!');
}

run().catch(err => {
  console.error('Fehler bei der Ausführung:', err);
  process.exit(1);
});
