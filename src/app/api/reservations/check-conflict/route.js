import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

function deriveDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d)) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// POST - Prüfe Zeitkonflikte
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { roomId, startTime, endTime, excludeId, date } = body;

    if (!roomId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'roomId, startTime und endTime sind erforderlich' },
        { status: 400 }
      );
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: 'Keine Datenbank-Verbindung' }, { status: 503 });
    }
    const collection = db.collection('reservations');

    // Ermittele lokales Datum (YYYY-MM-DD): bevorzugt explizit übergebenes date
    const dateStr = date || deriveDate(startTime);
    if (!dateStr) return NextResponse.json({ error: 'Ungültige Startzeit oder Datum' }, { status: 400 });

    const excludeFilter = [];
    if (excludeId !== null && typeof excludeId !== 'undefined') {
      const exNum = parseInt(excludeId, 10);
      if (!isNaN(exNum)) excludeFilter.push(exNum);
      excludeFilter.push(String(excludeId));
    }

    const query = {
      roomId: parseInt(roomId, 10),
      date: dateStr,
      ...(excludeFilter.length > 0 ? { id: { $nin: excludeFilter } } : {})
    };

    const dayDocs = await collection.find(query).toArray();

    const toMin = (t) => {
      if (!t) return null;
      if (typeof t === 'string' && t.includes('T')) { const dt = new Date(t); return isNaN(dt) ? null : dt.getUTCHours()*60 + dt.getUTCMinutes(); }
      if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) { const [h,m] = t.split(':').map(Number); return h*60+m; }
      const dt = new Date(t); return isNaN(dt) ? null : dt.getUTCHours()*60 + dt.getUTCMinutes();
    };
    const newStartMin = toMin(startTime);
    const newEndMin = toMin(endTime);

    const conflicts = dayDocs.filter(doc => {
      const s = toMin(doc.startTime); const e = toMin(doc.endTime);
      if (s == null || e == null || newStartMin == null || newEndMin == null) return false;
      return s < newEndMin && e > newStartMin;
    }).map(conflict => ({
      id: conflict.id,
      title: conflict.title,
      startTime: conflict.startTime,
      endTime: conflict.endTime,
      timeDisplay: (() => {
        try {
          const s = new Date(typeof conflict.startTime === 'string' && conflict.startTime.includes('T') ? conflict.startTime : `${conflict.date}T${conflict.startTime}:00`);
          const e = new Date(typeof conflict.endTime === 'string' && conflict.endTime.includes('T') ? conflict.endTime : `${conflict.date}T${conflict.endTime}:00`);
          return `${s.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} - ${e.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`;
        } catch (_) {
          return `${conflict.startTime} - ${conflict.endTime}`;
        }
      })()
    }));

    if (conflicts.length > 0) {
      return NextResponse.json({
        hasConflict: true,
        conflicts
      });
    }

    return NextResponse.json({ hasConflict: false, conflicts: [] });

  } catch (error) {
    console.error('Fehler bei Konfliktprüfung:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Konfliktprüfung' },
      { status: 500 }
    );
  }
}
