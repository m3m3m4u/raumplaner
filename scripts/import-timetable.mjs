#!/usr/bin/env node
/**
 * scripts/import-timetable.mjs
 * 
 * Universelles, blitzschnelles Import-Skript für Stundenpläne (z.B. aus Bildern / Vorlagen)
 * in die Raumplaner-MongoDB-Datenbank für das gesamte Schuljahr.
 * 
 * Aufruf:
 *   node scripts/import-timetable.mjs <datei.json> [--dry-run] [--clean-existing]
 *   node scripts/import-timetable.mjs --data='{...}' [--dry-run]
 * 
 * Format der JSON-Eingabe:
 * {
 *   "room": "Musikraum",        // Name oder ID
 *   "weeks": 43,                // Standard: 43
 *   "schoolYearStart": "2026-09-14", // Standard: 2026-09-14 (Montag Woche 1)
 *   "timetable": {
 *     "Montag": { "1.": "B1" },
 *     "Dienstag": { "1.": "B1", "2.": "C12", "5.": "C11" },
 *     "Mittwoch": { "1.": "B2/C2", "2.": "B2", "3.": "C2", "4.": "C13", "5.": "A21" },
 *     "Donnerstag": { "1.": "B1/ C0", "2.": "A1", "3.": "A22", "5.": "C2" },
 *     "Freitag": { "3.": "A23" }
 *   }
 * }
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'fs';
import crypto from 'crypto';
import { getDb } from '../src/lib/mongodb.js';

const ADMIN_PASSWORD_HASH = '1a612f9978510d19e0ef76c0db38f03f9ed5267d643d0a606fa4c179573344b9'; // sha256('872020')

// Standard-Schulstunden Fallback-Definitionen
const DEFAULT_HOUR_TIMES = {
  '1':   { start: [8, 0],   end: [8, 50] },
  '1.':  { start: [8, 0],   end: [8, 50] },
  '2a':  { start: [8, 50],  end: [9, 15] },
  '2b':  { start: [9, 15],  end: [9, 40] },
  '2':   { start: [8, 50],  end: [9, 40] },
  '2.':  { start: [8, 50],  end: [9, 40] },
  '3':   { start: [9, 45],  end: [10, 35] },
  '3.':  { start: [9, 45],  end: [10, 35] },
  '4':   { start: [10, 55], end: [11, 45] },
  '4.':  { start: [10, 55], end: [11, 45] },
  '5a':  { start: [11, 45], end: [12, 10] },
  '5b':  { start: [12, 15], end: [12, 40] },
  '5':   { start: [11, 45], end: [12, 40] },
  '5.':  { start: [11, 45], end: [12, 40] },
  '6':   { start: [12, 40], end: [13, 5] },
  '6.':  { start: [12, 40], end: [13, 5] },
  '7':   { start: [13, 5],  end: [13, 55] },
  '7.':  { start: [13, 5],  end: [13, 55] },
  '8':   { start: [13, 55], end: [14, 45] },
  '8.':  { start: [13, 55], end: [14, 45] },
  '9':   { start: [14, 45], end: [15, 35] },
  '9.':  { start: [14, 45], end: [15, 35] },
  '10a': { start: [15, 35], end: [16, 0] },
  '10':  { start: [15, 35], end: [16, 0] },
  '10.': { start: [15, 35], end: [16, 0] }
};

/**
 * Löst eine Stundennummer (z. B. 1, 2, "2.", "5", "5a", "1-2") dynamisch
 * anhand der im MongoDB-Schedule hinterlegten Zeiten der Schule auf.
 */
function resolveHourToTimes(hourKey, dbSchedule = []) {
  const str = String(hourKey).trim();

  // Stundenbereich wie "1-2" oder "1 - 3"
  if (str.includes('-')) {
    const [startH, endH] = str.split('-').map(s => s.trim());
    const tStart = resolveHourToTimes(startH, dbSchedule);
    const tEnd = resolveHourToTimes(endH, dbSchedule);
    return { start: tStart.start, end: tEnd.end, name: `${startH} - ${endH}` };
  }

  // 1. Suche in der DB Schedule Collection
  if (Array.isArray(dbSchedule) && dbSchedule.length > 0) {
    const cleanNum = str.replace(/\.$/, '');

    // Prüfe auf Unterstunden (z. B. "2a" und "2b" für "2", oder "5a" und "5b" für "5")
    const subSlots = dbSchedule.filter(s => s.name && s.name.startsWith(cleanNum) && /[a-z]/i.test(s.name));
    if (subSlots.length > 1 && !/[a-z]/i.test(str)) {
      subSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
      const first = subSlots[0];
      const last = subSlots[subSlots.length - 1];
      const [sh, sm] = first.startTime.split(':').map(Number);
      const [eh, em] = last.endTime.split(':').map(Number);
      return { start: [sh, sm], end: [eh, em], name: str };
    }

    // Exakter Match auf name (z. B. "1.", "3.", "2a", "5a", "Abend 1")
    const exact = dbSchedule.find(s => s.name === str || s.name === `${cleanNum}.` || s.name === cleanNum);
    if (exact) {
      const [sh, sm] = exact.startTime.split(':').map(Number);
      const [eh, em] = exact.endTime.split(':').map(Number);
      return { start: [sh, sm], end: [eh, em], name: exact.name };
    }
  }

  // 2. Fallback auf Standardzeiten
  const fallback = DEFAULT_HOUR_TIMES[str] || DEFAULT_HOUR_TIMES[str.replace(/\.$/, '')];
  if (fallback) {
    return { ...fallback, name: str };
  }

  console.warn(`[import-timetable] Stundennummer "${str}" nicht im Schedule gefunden, Standard 08:00–08:50 verwendet.`);
  return { start: [8, 0], end: [8, 50], name: str };
}

/**
 * Verbindet aufeinanderfolgende Stunden mit gleichem Titel am selben Tag zu einer einzigen zusammenhängenden Buchung.
 * WICHTIG: Nur innerhalb desselben Tages, niemals über mehrere Tage hinweg!
 */
function mergeConsecutiveSlotsPerDay(slots, dbSchedule) {
  // 1. Zeiten für alle Slots auflösen
  const enriched = slots.map(s => {
    const dayKey = s.day.toLowerCase().trim();
    const times = resolveHourToTimes(String(s.hour).trim(), dbSchedule);
    const startMin = times.start[0] * 60 + times.start[1];
    const endMin = times.end[0] * 60 + times.end[1];
    return {
      day: s.day,
      dayKey,
      hour: String(s.hour).trim(),
      title: String(s.title).trim(),
      times,
      startMin,
      endMin
    };
  });

  // 2. Strikt nach Wochentag gruppieren (kein Vermischen verschiedener Tage)
  const dayGroups = new Map();
  for (const s of enriched) {
    if (!dayGroups.has(s.dayKey)) {
      dayGroups.set(s.dayKey, []);
    }
    dayGroups.get(s.dayKey).push(s);
  }

  const result = [];
  let mergedCount = 0;

  for (const [dayKey, daySlots] of dayGroups.entries()) {
    // Nach Startzeit sortieren
    daySlots.sort((a, b) => a.startMin - b.startMin);

    const dayMerged = [];
    for (const slot of daySlots) {
      if (dayMerged.length === 0) {
        dayMerged.push(slot);
        continue;
      }

      const prev = dayMerged[dayMerged.length - 1];
      const sameTitle = prev.title.toLowerCase() === slot.title.toLowerCase();
      // Direkt anschließend (oder kurze Pause/Überschneidung <= 15 Min)
      const isConsecutive = slot.startMin <= prev.endMin + 15 && slot.startMin >= prev.startMin;

      if (sameTitle && isConsecutive) {
        console.log(`  [Verbindung] ${prev.day}: "${prev.hour}" und "${slot.hour}" (${prev.title}) werden zu einem Block zusammengefasst.`);
        prev.endMin = Math.max(prev.endMin, slot.endMin);
        const endHour = Math.floor(prev.endMin / 60);
        const endMin = prev.endMin % 60;
        prev.times.end = [endHour, endMin];
        prev.hour = `${prev.hour}-${slot.hour}`;
        prev.times.name = `${prev.times.name || prev.hour} - ${slot.times.name || slot.hour}`;
        mergedCount++;
      } else {
        dayMerged.push(slot);
      }
    }

    result.push(...dayMerged);
  }

  if (mergedCount > 0) {
    console.log(`Aufeinanderfolgende Stunden am selben Tag verbunden: ${mergedCount} Zusammenführung(en).`);
  }

  return result;
}

const DAY_OFFSETS = {
  'montag': 0, 'mo': 0, 'monday': 0,
  'dienstag': 1, 'di': 1, 'tuesday': 1,
  'mittwoch': 2, 'mi': 2, 'wednesday': 2,
  'donnerstag': 3, 'do': 3, 'thursday': 3,
  'freitag': 4, 'fr': 4, 'friday': 4
};

function formatDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadInput() {
  const args = process.argv.slice(2);
  let dataStr = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--data=')) {
      dataStr = a.slice(7);
    } else if (a === '--data' && args[i + 1]) {
      dataStr = args[i + 1];
      i++;
    } else if (!a.startsWith('--') && fs.existsSync(a)) {
      dataStr = fs.readFileSync(a, 'utf8');
    }
  }

  if (!dataStr && !process.stdin.isTTY) {
    dataStr = fs.readFileSync(0, 'utf8');
  }

  if (!dataStr) {
    console.error(`Verwendung: node scripts/import-timetable.mjs <datei.json> [--dry-run] [--clean-existing]`);
    process.exit(1);
  }

  if (dataStr.charCodeAt(0) === 0xFEFF) dataStr = dataStr.slice(1);
  return JSON.parse(dataStr);
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--dry');
  const cleanExisting = process.argv.includes('--clean-existing') || process.argv.includes('--replace') || process.argv.includes('--overwrite');

  const input = await loadInput();
  const db = await getDb();
  if (!db) {
    console.error('[import-timetable] Keine MongoDB-Verbindung (.env.local prüfen).');
    process.exit(1);
  }

  const roomsCol = db.collection('rooms');
  const reservationsCol = db.collection('reservations');
  const countersCol = db.collection('counters');
  const scheduleCol = db.collection('schedule');
  const dbSchedule = await scheduleCol.find().toArray();

  // Raum finden (per ID, exaktem Namen oder Teil-Match)
  let room = null;
  if (typeof input.room === 'number') {
    room = await roomsCol.findOne({ id: input.room });
  } else if (typeof input.room === 'string' && /^\d+$/.test(input.room.trim())) {
    room = await roomsCol.findOne({ id: parseInt(input.room.trim(), 10) });
  } else if (typeof input.room === 'string') {
    const term = input.room.trim();
    // Exakter Name
    room = await roomsCol.findOne({ name: { $regex: new RegExp(`^${term}$`, 'i') } });
    if (!room) {
      // Enthält-Suche
      const candidates = await roomsCol.find({ name: { $regex: new RegExp(term, 'i') } }).toArray();
      if (candidates.length === 1) room = candidates[0];
      else if (candidates.length > 1) {
        console.warn(`[import-timetable] Mehrere Räume für "${term}" gefunden: ${candidates.map(r=>r.name).join(', ')}. Wähle ersten: ${candidates[0].name}`);
        room = candidates[0];
      }
    }
  }

  if (!room) {
    console.error(`[import-timetable] Raum "${input.room}" konnte nicht in der Datenbank gefunden werden!`);
    process.exit(1);
  }

  console.log(`================================================================`);
  console.log(` STUNDENPLAN-IMPORT: ${room.name} (ID: ${room.id})`);
  console.log(` Modus: ${isDryRun ? 'DRY-RUN (Testlauf)' : 'LIVE-IMPORT'}`);
  console.log(`================================================================`);

  const weeksTotal = parseInt(input.weeks || 43, 10);
  const schoolYearStartStr = input.schoolYearStart || '2026-09-14';
  const [startY, startM, startD] = schoolYearStartStr.split('-').map(Number);
  const mondayWeek1 = new Date(startY, startM - 1, startD);

  // Slots aus Eingabeformat auflösen
  // Unterstützt { timetable: { "Montag": { "1.": "Titel" } } } ODER { slots: [ { day, hour, title } ] }
  const slotList = [];
  if (input.timetable && typeof input.timetable === 'object') {
    for (const [dayName, hours] of Object.entries(input.timetable)) {
      for (const [hourKey, title] of Object.entries(hours)) {
        if (!title || String(title).trim() === '') continue;
        slotList.push({ day: dayName, hour: hourKey, title: String(title).trim() });
      }
    }
  } else if (Array.isArray(input.slots)) {
    for (const s of input.slots) {
      if (s.title && String(s.title).trim()) {
        slotList.push(s);
      }
    }
  }

  if (slotList.length === 0) {
    console.error('[import-timetable] Keine Termine in der Eingabe gefunden.');
    process.exit(1);
  }

  console.log(`Gefundene Wochentermine: ${slotList.length}`);
  slotList.forEach(s => console.log(`  - ${s.day} ${s.hour}: ${s.title}`));

  // Automatisch aufeinanderfolgende Stunden am selben Tag zusammenführen (strictly per day)
  const processedSlots = mergeConsecutiveSlotsPerDay(slotList, dbSchedule);
  if (processedSlots.length !== slotList.length) {
    const fmt = (t) => `${String(t[0]).padStart(2, '0')}:${String(t[1]).padStart(2, '0')}`;
    console.log(`\nZusammengefasste Wochentermine nach Stunden-Verbindung: ${processedSlots.length}`);
    processedSlots.forEach(s => console.log(`  * ${s.day} ${s.hour} (${fmt(s.times.start)}-${fmt(s.times.end)}): ${s.title}`));
  }

  // Wenn --clean-existing gesetzt ist und nicht dry-run
  if (cleanExisting && !isDryRun) {
    console.log(`\nBereinige bestehende Reservierungen in Raum ${room.id} für das Schuljahr...`);
    const endDate = new Date(mondayWeek1);
    endDate.setDate(mondayWeek1.getDate() + (weeksTotal * 7) + 5);
    const delRes = await reservationsCol.deleteMany({
      roomId: room.id,
      date: { $gte: schoolYearStartStr, $lte: formatDateOnly(endDate) }
    });
    console.log(`Gelöscht: ${delRes.deletedCount} bisherige Reservierungen.`);
  }

  // Dokumente generieren
  const allDocs = [];
  const now = new Date().toISOString();

  for (const slot of processedSlots) {
    const dayKey = slot.dayKey || slot.day.toLowerCase().trim();
    const dayOffset = DAY_OFFSETS[dayKey] ?? 0;
    const times = slot.times || resolveHourToTimes(String(slot.hour).trim(), dbSchedule);

    const seriesId = crypto.randomUUID();

    for (let week = 1; week <= weeksTotal; week++) {
      const targetDate = new Date(startY, startM - 1, startD + dayOffset + (week - 1) * 7);
      const dateStr = formatDateOnly(targetDate);

      const startDt = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), times.start[0], times.start[1], 0, 0);
      const endDt = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), times.end[0], times.end[1], 0, 0);

      allDocs.push({
        roomId: room.id,
        title: `${slot.title} (Woche ${week}/${weeksTotal})`,
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
        seriesTotal: weeksTotal,
        stunde: times.name || hourKey,
        date: dateStr,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  console.log(`\nGenerierte Termine gesamt: ${allDocs.length} (${processedSlots.length} Slots × ${weeksTotal} Wochen)`);

  // Konfliktprüfung
  const minDate = allDocs[0].date;
  const maxDate = allDocs[allDocs.length - 1].date;
  const existingDocs = await reservationsCol.find({
    roomId: room.id,
    date: { $gte: minDate, $lte: maxDate }
  }).toArray();

  let conflicts = 0;
  for (const doc of allDocs) {
    const s = new Date(doc.startTime).getTime();
    const e = new Date(doc.endTime).getTime();
    const hit = existingDocs.find(ex => {
      if (ex.date !== doc.date) return false;
      const exS = new Date(ex.startTime).getTime();
      const exE = new Date(ex.endTime).getTime();
      return exS < e && exE > s;
    });
    if (hit) {
      if (conflicts < 5) console.warn(`  [Konflikt] ${doc.date} ${doc.title} überschneidet sich mit "${hit.title}"`);
      conflicts++;
    }
  }

  if (conflicts > 0) {
    console.warn(`\nACHTUNG: ${conflicts} Konflikte mit bestehenden Terminen gefunden!`);
    if (!cleanExisting && !isDryRun) {
      console.error('Abbruch wegen Konflikten. Nutze ggf. --clean-existing um Raum vorher zu leeren.');
      process.exit(1);
    }
  } else {
    console.log(`Konfliktprüfung: Perfekt! Keine Überschneidungen gefunden.`);
  }

  if (isDryRun) {
    console.log(`\n[DRY-RUN BEENDET] Es wurden keine Änderungen gespeichert.`);
    return;
  }

  // BLITZSCHNELLE BATCH-ID-VERGABE in EINEM Netzwerk-Roundtrip:
  console.log(`\nVergebe ${allDocs.length} IDs atomar im Batch...`);
  const counterRes = await countersCol.findOneAndUpdate(
    { _id: 'reservations' },
    { $inc: { seq: allDocs.length } },
    { returnDocument: 'after', upsert: true }
  );
  const endSeq = counterRes.seq || counterRes.value?.seq || allDocs.length;
  const startSeq = endSeq - allDocs.length + 1;

  for (let i = 0; i < allDocs.length; i++) {
    allDocs[i].id = startSeq + i;
  }

  // Batch insert
  console.log(`Speichere ${allDocs.length} Dokumente in MongoDB...`);
  const t0 = Date.now();
  const insertRes = await reservationsCol.insertMany(allDocs, { ordered: false });
  const dur = ((Date.now() - t0) / 1000).toFixed(2);

  console.log(`\nERFOLG! ${insertRes.insertedCount} Reservierungen in ${dur}s angelegt.`);
  console.log(`Raum ${room.name} ist jetzt für das gesamte Schuljahr gebucht!`);
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('[import-timetable] Fehler:', err);
  process.exit(1);
});
