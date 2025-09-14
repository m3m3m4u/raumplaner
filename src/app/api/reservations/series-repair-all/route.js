import { getDb } from '@/lib/mongodb';

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

    const body = await req.json().catch(() => ({}));
    const dryRun = typeof body.dryRun === 'boolean' ? body.dryRun : true;
    const mode = body.mode || 'all'; // 'all' | 'future'
    const limit = body.limit && Number.isInteger(body.limit) ? body.limit : null;

    const collection = db.collection('reservations');
    let seriesIds = await collection.distinct('seriesId', { seriesId: { $exists: true, $type: 'string', $ne: '' } });
    seriesIds = (seriesIds || []).filter(Boolean);
    if (limit && seriesIds.length > limit) {
      seriesIds = seriesIds.slice(0, limit);
    }

    const url = new URL(req.url);
    const base = `${url.protocol}//${url.host}`;

    const details = [];
    let totalInserted = 0;
    let successCount = 0;
    let failCount = 0;

    for (const sid of seriesIds) {
      try {
        const resp = await fetch(`${base}/api/reservations/series-repair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seriesId: sid, mode, dryRun })
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          failCount++;
          details.push({ seriesId: sid, error: json.error || resp.statusText || String(resp.status) });
          continue;
        }
        successCount++;
        totalInserted += json.inserted || 0;
        let present = null, missing = null, conflicts = null;
        if (Array.isArray(json.weeks)) {
          present = json.weeks.filter(w => w.status === 'present').length;
          missing = json.weeks.filter(w => w.status === 'missing').length;
          conflicts = json.weeks.filter(w => w.status === 'conflict').length;
        }
        details.push({ seriesId: sid, analyzed: json.analyzed, toCreate: json.toCreate, inserted: json.inserted, present, missing, conflicts });
      } catch (e) {
        failCount++;
        details.push({ seriesId: sid, error: e.message || 'Unbekannter Fehler' });
      }
    }

    return Response.json({ success: true, dryRun, mode, totalSeries: seriesIds.length, successCount, failCount, totalInserted, details });
  } catch (err) {
    console.error('series-repair-all error', err);
    return Response.json({ error: 'Fehler bei Serien-Gesamtreparatur', details: err.message }, { status: 500 });
  }
}
