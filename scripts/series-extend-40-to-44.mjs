#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback auf .env

// Importiere direkt aus dem Projekt (keine Alias-Auflösung '@')
import { getDb, getNextSequence } from '../src/lib/mongodb.js';

function parseArgs(argv) {
  const args = { dryRun: false, limit: 0, startAfter: null };
  for (const a of argv.slice(2)) {
    if (a === '--dryRun' || a === '--dry-run' || a === '--dry') args.dryRun = true;
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1], 10) || 0;
    else if (a.startsWith('--startAfter=')) args.startAfter = a.split('=')[1] || null;
  }
  return args;
}

function uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

async function main() {
  const args = parseArgs(process.argv);
  console.log('[extend-40-to-44] Start', args);

  const db = await getDb();
  if (!db) {
    console.error('[extend-40-to-44] Keine DB-Verbindung. Bitte MONGODB_URI und MONGODB_DB setzen (.env.local).');
    process.exit(2);
  }
  const reservations = db.collection('reservations');

  // Kandidaten finden (seriesTotal=40 oder max(seriesIndex)=40)
  const seriesWithTotal40 = await reservations.distinct('seriesId', { seriesId: { $exists: true, $type: 'string', $ne: '' }, seriesTotal: 40 });
  const agg = await reservations.aggregate([
    { $match: { seriesId: { $exists: true, $type: 'string', $ne: '' } } },
    { $group: { _id: '$seriesId', maxIndex: { $max: '$seriesIndex' }, anyTotal40: { $max: { $cond: [ { $eq: ['$seriesTotal', 40] }, 1, 0 ] } } } },
    { $match: { $or: [ { maxIndex: 40 }, { anyTotal40: 1 } ] } },
    { $project: { _id: 0, seriesId: '$_id' } }
  ]).toArray();
  const seriesFromAgg = (agg || []).map(x => x.seriesId).filter(Boolean);
  const allCandidates = uniqSorted([ ...(seriesWithTotal40 || []), ...seriesFromAgg ]);

  let list = allCandidates;
  if (args.startAfter) list = list.filter(id => id > args.startAfter);
  if (args.limit && args.limit > 0) list = list.slice(0, args.limit);

  if (!list.length) {
    console.log('[extend-40-to-44] Keine passenden Serien gefunden. totalCandidates=', allCandidates.length);
    return;
  }

  let updated = 0;
  let inserted = 0;
  const details = [];

  // Hilfsfunktionen (aus series-repair nachempfunden)
  const normalizeTimeString = (value) => {
    if (!value) return null;
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(':').map(Number);
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    const d = new Date(value);
    if (isNaN(d)) return null;
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const parseDateOnly = (str) => {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const formatDateOnly = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const timeToMinutes = (t) => {
    if (!t) return null;
    if (typeof t === 'string' && t.includes('T')) {
      const d = new Date(t);
      if (isNaN(d)) return null;
      return d.getHours() * 60 + d.getMinutes();
    }
    const hhmm = normalizeTimeString(t);
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  for (const sid of list) {
    // Metadaten auf 44 setzen (falls echt)
    let modified = 0;
    if (!args.dryRun) {
      const upRes = await reservations.updateMany({ seriesId: sid }, { $set: { seriesTotal: 44, updatedAt: new Date().toISOString() } });
      modified = upRes.modifiedCount || 0;
      updated += modified;
    }

    // Bestehende Einträge der Serie laden
    const existing = await reservations.find({ seriesId: sid }).toArray();
    if (!existing || existing.length === 0) {
      details.push({ seriesId: sid, updatedMeta: modified, info: 'Keine Reservierungen zu dieser Serie gefunden' });
      continue;
    }
    const byIndex = existing.filter(r => typeof r.seriesIndex === 'number');
    const maxIndex = byIndex.length ? Math.max(...byIndex.map(r => r.seriesIndex)) : existing.length;
    const titleTotals = existing.map(r => {
      const m = typeof r.title === 'string' ? r.title.match(/\(Woche\s+\d+\/(\d+)\)/) : null;
      return m ? parseInt(m[1], 10) : 0;
    }).filter(Boolean);
    const seriesTotal = Math.max(
      maxIndex,
      ...existing.map(r => r.seriesTotal || 0),
      ...(titleTotals.length ? titleTotals : [0]),
      44
    ) || maxIndex;

    // Anker bestimmen (Index 1 oder ältestes Datum)
    const sorted = [...existing].sort((a, b) => {
      const da = (a.date || (a.startTime && a.startTime.slice ? a.startTime.slice(0,10) : ''));
      const db = (b.date || (b.startTime && b.startTime.slice ? b.startTime.slice(0,10) : ''));
      return (da||'') < (db||'') ? -1 : 1;
    });
    const anchor = existing.find(r => r.seriesIndex === 1) || sorted[0];
    const anchorDateStr = anchor.date || (anchor.startTime ? anchor.startTime.slice(0,10) : null);
    if (!anchorDateStr) {
      details.push({ seriesId: sid, updatedMeta: modified, error: 'Kein Startdatum ermittelbar' });
      continue;
    }
    const anchorDate = parseDateOnly(anchorDateStr);
    const startHHMM = normalizeTimeString(anchor.startTime);
    const endHHMM = normalizeTimeString(anchor.endTime);
    const roomId = anchor.roomId;
    const baseTitle = (anchor.title || '').replace(/ \(Woche \d+\/\d+\)$/, '');

    // Alle Wochen prüfen und ggf. anlegen
    let insCount = 0;
    for (let idx = 1; idx <= seriesTotal; idx++) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() + (idx - 1) * 7);
      const dateStr = formatDateOnly(d);

      const dayDocs = await reservations.find({ roomId, date: dateStr }).toArray();
      const tStartMin = timeToMinutes(startHHMM);
      const tEndMin = timeToMinutes(endHHMM);

      const present = dayDocs.find(doc => {
        const sMin = timeToMinutes(doc.startTime);
        const eMin = timeToMinutes(doc.endTime);
        if (sMin === null || eMin === null) return false;
        const timeMatch = (sMin === tStartMin && eMin === tEndMin);
        if (!timeMatch) return false;
        if (doc.seriesId === sid) return true;
        const suffix = new RegExp(`\\(Woche\\s+${idx}\\/${seriesTotal}\\)$`);
        return typeof doc.title === 'string' && suffix.test(doc.title);
      });
      if (present) continue;

      const overlapping = dayDocs.find(doc => {
        const sMin = timeToMinutes(doc.startTime);
        const eMin = timeToMinutes(doc.endTime);
        if (sMin === null || eMin === null) return false;
        return sMin < tEndMin && eMin > tStartMin;
      });
      if (overlapping) continue;

      if (!args.dryRun) {
        const newId = await getNextSequence(db, 'reservations');
        const isoStart = new Date(dateStr + 'T' + startHHMM + ':00').toISOString();
        const isoEnd = new Date(dateStr + 'T' + endHHMM + ':00').toISOString();
        const candidate = {
          id: newId,
          roomId,
          title: `${baseTitle} (Woche ${idx}/${seriesTotal})`,
          date: dateStr,
          startTime: isoStart,
          endTime: isoEnd,
          seriesId: sid,
          seriesIndex: idx,
          seriesTotal,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const resIns = await reservations.insertOne(candidate);
        if (resIns?.acknowledged) insCount++;
      }
    }

    inserted += insCount;
    details.push({ seriesId: sid, updatedMeta: modified, inserted: insCount, dryRun: !!args.dryRun });
  }

  const nextStartAfter = list[list.length - 1];
  const remaining = allCandidates.filter(id => id > nextStartAfter).length;
  const out = { success: true, totalCandidates: allCandidates.length, processed: list.length, remaining, nextStartAfter, updated, inserted, details };
  console.log(JSON.stringify(out, null, 2));
}

main().catch(err => {
  console.error('[extend-40-to-44] Fehler:', err?.message || err);
  process.exit(1);
});
