import { getDb } from '@/lib/mongodb';

// Sicherstellen, dass wir im Node.js-Runtime laufen (MongoDB-Treiber benötigt Node)
export const runtime = 'nodejs';

const GENERAL_PASSWORD = process.env.ADMIN_GENERAL_PASSWORD || process.env.ADMIN_PASSWORD || '872020';

export async function POST(req) {
  try {
    const db = await getDb();
    if (!db) return Response.json({ error: 'Keine Datenbank-Verbindung' }, { status: 503 });

    // Admin-Check
    const headerPwd = req.headers.get('x-admin-password');
    if (!headerPwd || String(headerPwd) !== String(GENERAL_PASSWORD)) {
      return Response.json({ error: 'Admin-Passwort erforderlich oder falsch' }, { status: 403 });
    }

    const reservations = db.collection('reservations');

    // Query-Parameter: Batch-Größe, Cursor und Dry-Run
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '25', 10) || 25, 200));
    const startAfter = searchParams.get('startAfter'); // lexikografischer Cursor (seriesId)
    const dryRun = ['1','true','yes'].includes(String(searchParams.get('dryRun') || '').toLowerCase());

    // Serien-IDs mit seriesTotal=40 ODER mit max(seriesIndex)=40 (falls seriesTotal fehlt)
    const seriesWithTotal40 = await reservations.distinct('seriesId', { seriesId: { $exists: true, $type: 'string', $ne: '' }, seriesTotal: 40 });
    const agg = await reservations.aggregate([
      { $match: { seriesId: { $exists: true, $type: 'string', $ne: '' } } },
      { $group: { _id: '$seriesId', maxIndex: { $max: '$seriesIndex' }, anyTotal40: { $max: { $cond: [ { $eq: ['$seriesTotal', 40] }, 1, 0 ] } } } },
      { $match: { $or: [ { maxIndex: 40 }, { anyTotal40: 1 } ] } },
      { $project: { _id: 0, seriesId: '$_id' } }
    ]).toArray();
    const seriesFromAgg = (agg || []).map(x => x.seriesId).filter(Boolean);
    // Gesamtkandidaten sortiert
    const allCandidates = Array.from(new Set([ ...(seriesWithTotal40 || []), ...seriesFromAgg ])).filter(Boolean).sort();
    // Cursor anwenden
    const remainingAfterCursor = startAfter ? allCandidates.filter(id => id > startAfter) : allCandidates.slice();
    if (remainingAfterCursor.length === 0) {
      return Response.json({ success: true, message: 'Keine passenden Serien (mehr) gefunden', totalCandidates: allCandidates.length, processed: 0, remaining: 0, nextStartAfter: null, updated: 0, inserted: 0, details: [] });
    }

    const batch = remainingAfterCursor.slice(0, limit);
    let updatedDocs = 0;
    let totalInserted = 0;
    const details = [];

    // 1) Metadaten aller Dokumente der Serien im Batch auf 44 setzen
    for (const sid of batch) {
      let modified = 0;
      if (!dryRun) {
        const upRes = await reservations.updateMany({ seriesId: sid }, { $set: { seriesTotal: 44, updatedAt: new Date().toISOString() } });
        modified = upRes.modifiedCount || 0;
        updatedDocs += modified;
      }

      // 2) Reparatur ausführen, um Wochen 41–44 ggf. anzulegen
      let inserted = 0;
      if (!dryRun) {
        const url = new URL(req.url);
        const base = `${url.protocol}//${url.host}`;
        try {
          const resp = await fetch(`${base}/api/reservations/series-repair`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ seriesId: sid, mode: 'all', dryRun: false, assumedTotal: 44 })
          });
          const json = await resp.json().catch(() => ({}));
          if (resp.ok) {
            inserted = json.inserted || 0;
            totalInserted += inserted;
            details.push({ seriesId: sid, updatedMeta: modified, inserted });
          } else {
            details.push({ seriesId: sid, updatedMeta: modified, error: json.error || resp.statusText || String(resp.status) });
          }
        } catch (e) {
          details.push({ seriesId: sid, updatedMeta: modified, error: e.message || 'Unbekannter Fehler' });
        }
      } else {
        // Dry-Run Detailausgabe
        details.push({ seriesId: sid, wouldUpdateMetaTo: 44, wouldCallRepair: true });
      }
    }

    const nextStartAfter = batch.length ? batch[batch.length - 1] : (startAfter || null);
    const remaining = remainingAfterCursor.length - batch.length;
    return Response.json({ success: true, totalCandidates: allCandidates.length, processed: batch.length, remaining, nextStartAfter, updated: updatedDocs, inserted: totalInserted, details });
  } catch (err) {
    console.error('series-extend-40-to-44 error', err);
    return Response.json({ error: 'Fehler bei Serien-Erweiterung', details: err.message }, { status: 500 });
  }
}
