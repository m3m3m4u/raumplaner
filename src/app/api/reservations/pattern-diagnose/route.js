import { getDb } from '@/lib/mongodb';

function normalizeHHMM(v) {
  if (!v) return null;
  if (/^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':').map(Number);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  const d = new Date(v);
  if (isNaN(d)) return null;
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function nextWeekday(from, weekday) {
  // JS: 0=So, 1=Mo, ... 6=Sa
  const d = new Date(from);
  const delta = (weekday + 7 - d.getDay()) % 7;
  d.setDate(d.getDate() + (delta === 0 ? 7 : delta));
  return d;
}

export async function POST(req) {
  try {
    const db = await getDb();
    if (!db) return Response.json({ error: 'Keine Datenbank-Verbindung' }, { status: 503 });
    const collection = db.collection('reservations');

    const body = await req.json();
    let { roomId, weekday = 4, startHHMM, endHHMM, mode = 'all', totalWeeks = 40, anchorDate } = body || {};
    roomId = parseInt(roomId);
    startHHMM = normalizeHHMM(startHHMM);
    endHHMM = normalizeHHMM(endHHMM);
    if (!roomId || !startHHMM || !endHHMM) {
      return Response.json({ error: 'roomId, startHHMM und endHHMM sind erforderlich' }, { status: 400 });
    }
    if (weekday < 0 || weekday > 6) weekday = 4;

    // Anker bestimmen: 1) explizit, 2) früheste existierende passende Reservierung am gewünschten Wochentag, 3) nächster Zielwochentag ab heute
    let anchor;
    if (anchorDate) {
      anchor = new Date(anchorDate);
    } else {
      const earliest = await collection.find({
        roomId,
        $or: [
          { startTime: startHHMM }, { startTime: { $regex: `T${startHHMM}:` } }
        ]
      }).sort({ date: 1, startTime: 1 }).toArray();
      const candidate = earliest.find(r => {
        const d = new Date(r.startTime);
        return d.getDay() === weekday && normalizeHHMM(r.endTime) === endHHMM;
      });
      if (candidate) {
        const ds = candidate.startTime.slice(0,10);
        anchor = new Date(ds);
      } else {
        anchor = nextWeekday(new Date(), weekday);
      }
    }

    const todayStr = formatDateOnly(new Date());
    const tStartMin = ((d) => { const [h,m] = d.split(':').map(Number); return h*60+m; })(startHHMM);
    const tEndMin = ((d) => { const [h,m] = d.split(':').map(Number); return h*60+m; })(endHHMM);
    const toMin = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && val.includes('T')) {
        const dt = new Date(val);
        if (isNaN(dt)) return null;
        return dt.getHours()*60 + dt.getMinutes();
      }
      const hhmm = normalizeHHMM(val);
      if (!hhmm) return null;
      const [h,m] = hhmm.split(':').map(Number);
      return h*60+m;
    };
    const weeks = [];
    for (let idx = 1; idx <= parseInt(totalWeeks); idx++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + (idx - 1) * 7);
      const dateStr = formatDateOnly(d);
      if (mode === 'future' && dateStr < todayStr) { weeks.push({ idx, date: dateStr, status: 'past' }); continue; }

      const dayDocs = await collection.find({ roomId, date: dateStr }).toArray();
      const exact = dayDocs.find(doc => {
        const sMin = toMin(doc.startTime); const eMin = toMin(doc.endTime);
        if (sMin === null || eMin === null) return false;
        return sMin === tStartMin && eMin === tEndMin;
      });
      if (exact) { weeks.push({ idx, date: dateStr, status: 'present', title: exact.title, id: exact.id }); continue; }

      // Konfliktprüfung (Überlappung)
      const overlapping = dayDocs.find(doc => {
        const sMin = toMin(doc.startTime); const eMin = toMin(doc.endTime);
        if (sMin === null || eMin === null) return false;
        return sMin < tEndMin && eMin > tStartMin;
      });
      if (overlapping) { weeks.push({ idx, date: dateStr, status: 'conflict', conflictTitle: overlapping.title, conflictId: overlapping.id }); continue; }
      weeks.push({ idx, date: dateStr, status: 'missing' });
    }

    const summary = {
      present: weeks.filter(w => w.status === 'present').length,
      missing: weeks.filter(w => w.status === 'missing').length,
      conflicts: weeks.filter(w => w.status === 'conflict').length,
      past: weeks.filter(w => w.status === 'past').length
    };
    return Response.json({ success: true, roomId, weekday, startHHMM, endHHMM, totalWeeks, weeks, summary });
  } catch (err) {
    console.error('pattern-diagnose error', err);
    return Response.json({ error: 'Fehler bei Muster-Diagnose', details: err.message }, { status: 500 });
  }
}
