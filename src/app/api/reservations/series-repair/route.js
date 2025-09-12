import { getDb, getNextSequence } from '@/lib/mongodb';

function normalizeTimeString(value) {
  if (!value) return null;
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(':').map(Number);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  const d = new Date(value);
  if (isNaN(d)) return null;
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function parseDateOnly(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function POST(req) {
  try {
    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung' }, { status: 503 });
    }
  const { seriesId, mode = 'future', dryRun = false, assumedTotal } = await req.json();
    if (!seriesId) return Response.json({ error: 'seriesId erforderlich' }, { status: 400 });

    const collection = db.collection('reservations');
    const existing = await collection.find({ seriesId }).toArray();
    if (!existing || existing.length === 0) {
      return Response.json({ error: 'Keine Reservierungen zu dieser Serie gefunden' }, { status: 404 });
    }

    // Serie analysieren
    const byIndex = existing.filter(r => typeof r.seriesIndex === 'number');
    const minIndex = byIndex.length ? Math.min(...byIndex.map(r => r.seriesIndex)) : 1;
    const maxIndex = byIndex.length ? Math.max(...byIndex.map(r => r.seriesIndex)) : existing.length;
    // Titelbasierte Erkennung ("(Woche x/y)")
    const titleTotals = existing.map(r => {
      const m = typeof r.title === 'string' ? r.title.match(/\(Woche\s+\d+\/(\d+)\)/) : null;
      return m ? parseInt(m[1], 10) : 0;
    }).filter(Boolean);
    let seriesTotal = Math.max(
      maxIndex,
      ...existing.map(r => r.seriesTotal || 0),
      ...(titleTotals.length ? titleTotals : [0]),
      (assumedTotal ? parseInt(assumedTotal, 10) : 0)
    ) || maxIndex;

    // Anker bestimmen: versuche Index 1, sonst frühestes Datum
    const anchor = existing.find(r => r.seriesIndex === 1) || existing.sort((a,b) => {
      const da = (r => r.date || (r.startTime && r.startTime.slice ? r.startTime.slice(0,10) : null))(a);
      const dbb = (r => r.date || (r.startTime && r.startTime.slice ? r.startTime.slice(0,10) : null))(b);
      return (da||'') < (dbb||'') ? -1 : 1;
    })[0];

    const anchorDateStr = anchor.date || (anchor.startTime ? anchor.startTime.slice(0,10) : null);
    if (!anchorDateStr) {
      return Response.json({ error: 'Konnte Startdatum der Serie nicht ermitteln' }, { status: 400 });
    }
    const anchorDate = parseDateOnly(anchorDateStr);

    // Zeiten und Raum aus repräsentativem Eintrag
    const startHHMM = normalizeTimeString(anchor.startTime);
    const endHHMM = normalizeTimeString(anchor.endTime);
    const roomId = anchor.roomId;
    const baseTitle = (anchor.title || '').replace(/ \(Woche \d+\/\d+\)$/, '');

    // Existierende Wochen-Indizes set
    const presentIndices = new Set(existing.map(r => r.seriesIndex).filter(n => typeof n === 'number'));
    const presentDates = new Set(existing.map(r => (r.date || (r.startTime && r.startTime.slice ? r.startTime.slice(0,10) : null))).filter(Boolean));

    const todayStr = formatDateOnly(new Date());
    const toCreate = [];
    const weeks = [];
  for (let idx = 1; idx <= seriesTotal; idx++) {
      // Erwartetes Datum aus Anchor + (idx-1)*7 Tage
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() + (idx - 1) * 7);
      const dateStr = formatDateOnly(d);

      if (mode === 'future' && dateStr < todayStr) {
        weeks.push({ idx, date: dateStr, status: 'past' });
        continue;
      }

      // Falls Index vorhanden oder Datum vorhanden, überspringen
      if (presentIndices.has(idx) || presentDates.has(dateStr)) {
        weeks.push({ idx, date: dateStr, status: 'present' });
        continue;
      }

      // Konfliktprüfung am Zieltag
      const conflict = await collection.findOne({
        roomId,
        date: dateStr,
        $or: [
          { $and: [ { startTime: { $lte: startHHMM } }, { endTime: { $gt: startHHMM } } ] },
          { $and: [ { startTime: { $lt: endHHMM } }, { endTime: { $gte: endHHMM } } ] },
          { $and: [ { startTime: { $gte: startHHMM } }, { endTime: { $lte: endHHMM } } ] }
        ]
      });
      if (conflict) {
        weeks.push({ idx, date: dateStr, status: 'conflict', conflictTitle: conflict.title, conflictId: conflict.id });
        continue; // überspringen, nicht erzwingen
      }

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
        seriesId,
        seriesIndex: idx,
        seriesTotal,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      toCreate.push(candidate);
      weeks.push({ idx, date: dateStr, status: 'missing' });
    }

    let inserted = 0;
    if (!dryRun) {
      for (const doc of toCreate) {
        const res = await collection.insertOne(doc);
        if (res?.acknowledged) inserted++;
      }
    }

    return Response.json({ success: true, seriesId, analyzed: existing.length, toCreate: toCreate.length, inserted, weeks });
  } catch (err) {
    console.error('series-repair error', err);
    return Response.json({ error: 'Fehler bei Serien-Reparatur', details: err.message }, { status: 500 });
  }
}
