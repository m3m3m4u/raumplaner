import { getDb } from '@/lib/mongodb';

// Nutzt das serverseitige Admin-Passwort wie die übrigen Reservations-Routen
const GENERAL_PASSWORD = process.env.ADMIN_GENERAL_PASSWORD || process.env.ADMIN_PASSWORD || '872020';

// POST: Cleanup-Report (dryRun=true/false)
// DELETE: Tatsächliche Löschung (equivalent zu POST mit dryRun=false)
export async function POST(request) {
  try {
    const db = await getDb();
    if (!db) return Response.json({ error: 'Keine Datenbank-Verbindung' }, { status: 503 });
    const collection = db.collection('reservations');

    const body = await request.json().catch(() => ({}));
    const { dryRun = true } = body || {};

    // Admin-Check per Header
    const headerPwd = request.headers.get('x-admin-password');
    if (!headerPwd || String(headerPwd) !== String(GENERAL_PASSWORD)) {
      return Response.json({ error: 'Admin-Passwort erforderlich oder falsch' }, { status: 403 });
    }

    // Alle ohne seriesId (= Einzeltermine)
    const singles = await collection.find({ $or: [ { seriesId: { $exists: false } }, { seriesId: null }, { seriesId: '' } ] }).toArray();
    const countSingles = singles.length;

    if (dryRun) {
      // Nur Bericht zurückgeben
      return Response.json({ success: true, dryRun: true, singles: countSingles, sample: singles.slice(0, 20).map(s => ({ id: s.id, title: s.title, roomId: s.roomId, date: s.date })) });
    }

    // Hard delete
    const result = await collection.deleteMany({ $or: [ { seriesId: { $exists: false } }, { seriesId: null }, { seriesId: '' } ] });
    return Response.json({ success: true, dryRun: false, deleted: result.deletedCount });
  } catch (err) {
    console.error('cleanup-singles POST error', err);
    return Response.json({ error: 'Fehler bei Cleanup', details: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  // Alias für POST mit dryRun=false
  try {
    const db = await getDb();
    if (!db) return Response.json({ error: 'Keine Datenbank-Verbindung' }, { status: 503 });
    const collection = db.collection('reservations');
    const headerPwd = request.headers.get('x-admin-password');
    if (!headerPwd || String(headerPwd) !== String(GENERAL_PASSWORD)) {
      return Response.json({ error: 'Admin-Passwort erforderlich oder falsch' }, { status: 403 });
    }
    const result = await collection.deleteMany({ $or: [ { seriesId: { $exists: false } }, { seriesId: null }, { seriesId: '' } ] });
    return Response.json({ success: true, dryRun: false, deleted: result.deletedCount });
  } catch (err) {
    console.error('cleanup-singles DELETE error', err);
    return Response.json({ error: 'Fehler bei Cleanup', details: err.message }, { status: 500 });
  }
}
