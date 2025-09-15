import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

// POST - Prüfe Zeitkonflikte
export async function POST(request) {
  try {
    const body = await request.json();
    const { roomId, startTime, endTime, excludeId } = body;

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

    // Ermittele lokales Datum (YYYY-MM-DD) aus startTime
    const d = new Date(startTime);
    if (isNaN(d)) return NextResponse.json({ error: 'Ungültige Startzeit' }, { status: 400 });
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const dayDocs = await collection.find({ roomId: parseInt(roomId), date: dateStr, ...(excludeId ? { id: { $ne: parseInt(excludeId) } } : {}) }).toArray();

    const toMin = (t) => {
      if (!t) return null;
      if (typeof t === 'string' && t.includes('T')) { const dt = new Date(t); return isNaN(dt) ? null : dt.getHours()*60 + dt.getMinutes(); }
      if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) { const [h,m] = t.split(':').map(Number); return h*60+m; }
      const dt = new Date(t); return isNaN(dt) ? null : dt.getHours()*60 + dt.getMinutes();
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
        const s = new Date(typeof conflict.startTime === 'string' && conflict.startTime.includes('T') ? conflict.startTime : `${conflict.date}T${conflict.startTime}:00`);
        const e = new Date(typeof conflict.endTime === 'string' && conflict.endTime.includes('T') ? conflict.endTime : `${conflict.date}T${conflict.endTime}:00`);
        return `${s.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} - ${e.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`;
      })()
    }));

    if (conflicts.length > 0) {
      // Formatiere Konfliktinformationen
      const conflictInfo = conflicts.map(conflict => ({
        id: conflict.id,
        title: conflict.title,
        startTime: conflict.startTime,
        endTime: conflict.endTime,
        timeDisplay: `${new Date(conflict.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - ${new Date(conflict.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
      }));

      return NextResponse.json({
        hasConflict: true,
        conflicts: conflictInfo
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
