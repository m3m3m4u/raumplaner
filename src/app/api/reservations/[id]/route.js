import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { emitReservationsChanged } from '@/lib/events';
import crypto from 'crypto';

const GENERAL_PASSWORD = process.env.ADMIN_GENERAL_PASSWORD || process.env.ADMIN_PASSWORD || '872020';

function normalizeTimeString(value) {
  if (!value) return null;
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(':').map(Number);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const d = new Date(value);
  if (isNaN(d)) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function deriveDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d)) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// GET - Einzelne Reservierung nach ID abrufen
export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Ungültige ID' }, { status: 400 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Keine Datenbank-Verbindung' }, { status: 503 });
    }

    const reservation = await db.collection('reservations').findOne({ id });
    if (!reservation) {
      return NextResponse.json({ success: false, error: 'Reservierung nicht gefunden' }, { status: 404 });
    }

    const safe = { ...reservation };
    safe.hasDeletionPassword = !!safe.deletionPasswordHash;
    delete safe.deletionPasswordHash;

    return NextResponse.json({ success: true, data: safe });
  } catch (error) {
    console.error('GET /api/reservations/[id] Error:', error);
    return NextResponse.json({ success: false, error: 'Fehler beim Laden der Reservierung' }, { status: 500 });
  }
}

// PUT - Reservierung aktualisieren
export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Ungültige ID' }, { status: 400 });
    }

    const body = await request.json();
    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Keine Datenbank-Verbindung' }, { status: 503 });
    }
    const collection = db.collection('reservations');

    const existing = await collection.findOne({ id });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Reservierung nicht gefunden' }, { status: 404 });
    }

    // Passworteingabe prüfen
    if (existing.deletionPasswordHash) {
      const headerPwd = request.headers.get('x-deletion-password');
      const bodyPwd = body.deletionPassword;
      const provided = headerPwd || bodyPwd;
      if (!provided) {
        return NextResponse.json({ success: false, error: 'Passwort zum Bearbeiten erforderlich' }, { status: 403 });
      }
      if (String(provided) !== GENERAL_PASSWORD) {
        const providedHash = crypto.createHash('sha256').update(String(provided)).digest('hex');
        if (providedHash !== existing.deletionPasswordHash) {
          return NextResponse.json({ success: false, error: 'Passwort zum Bearbeiten falsch' }, { status: 403 });
        }
      }
    }

    const updateData = { ...body, id };
    if (!updateData.date && updateData.startTime) {
      const derived = deriveDate(updateData.startTime);
      if (derived) updateData.date = derived;
    }

    const startNorm = normalizeTimeString(updateData.startTime);
    const endNorm = normalizeTimeString(updateData.endTime);
    if (startNorm) updateData.startTime = startNorm;
    if (endNorm) updateData.endTime = endNorm;

    if (typeof updateData.title === 'string') updateData.title = updateData.title.trim();
    if (typeof updateData.createdBy === 'string') updateData.createdBy = updateData.createdBy.trim();
    if (typeof updateData.description === 'string') updateData.description = updateData.description.trim();

    if (updateData.roomId) updateData.roomId = parseInt(updateData.roomId, 10);

    // Zeitkonflikt prüfen
    if (updateData.roomId && updateData.date && updateData.startTime && updateData.endTime) {
      const dayDocs = await collection.find({ roomId: updateData.roomId, date: updateData.date, id: { $ne: id } }).toArray();
      const toMin = (t) => {
        if (!t) return null;
        if (typeof t === 'string' && t.includes('T')) { const d = new Date(t); return isNaN(d) ? null : d.getHours() * 60 + d.getMinutes(); }
        if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
        const d = new Date(t); return isNaN(d) ? null : d.getHours() * 60 + d.getMinutes();
      };
      const newStartMin = toMin(updateData.startTime);
      const newEndMin = toMin(updateData.endTime);

      if (newStartMin !== null && newEndMin !== null && newStartMin >= newEndMin) {
        return NextResponse.json({ success: false, error: 'Endzeit muss nach der Startzeit liegen' }, { status: 400 });
      }

      const conflictDoc = dayDocs.find(doc => {
        const s = toMin(doc.startTime); const e = toMin(doc.endTime);
        if (s == null || e == null || newStartMin == null || newEndMin == null) return false;
        return s < newEndMin && e > newStartMin;
      });
      if (conflictDoc) {
        return NextResponse.json({ success: false, error: 'Der Raum ist zu dieser Zeit bereits reserviert', conflict: { id: conflictDoc.id, title: conflictDoc.title } }, { status: 409 });
      }
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (updateData.date && timeRegex.test(updateData.startTime) && timeRegex.test(updateData.endTime)) {
      updateData.startTime = new Date(updateData.date + 'T' + updateData.startTime + ':00').toISOString();
      updateData.endTime = new Date(updateData.date + 'T' + updateData.endTime + ':00').toISOString();
    }

    updateData.updatedAt = new Date().toISOString();
    delete updateData.deletionPassword;
    delete updateData.requireDeletionPassword;
    delete updateData.id;

    if (typeof body.requireDeletionPassword !== 'undefined') {
      if (body.requireDeletionPassword) {
        const pwd = body.deletionPassword && String(body.deletionPassword).length > 0 ? String(body.deletionPassword) : '872020';
        updateData.deletionPasswordHash = crypto.createHash('sha256').update(pwd).digest('hex');
      } else {
        await collection.updateOne({ id }, { $unset: { deletionPasswordHash: '' } });
      }
    }

    await collection.updateOne({ id }, { $set: updateData });
    const updated = await collection.findOne({ id });
    const safeOut = { ...updated };
    safeOut.hasDeletionPassword = !!safeOut.deletionPasswordHash;
    delete safeOut.deletionPasswordHash;

    try { emitReservationsChanged({ action: 'update', id }); } catch (_) {}
    return NextResponse.json({ success: true, data: safeOut });
  } catch (error) {
    console.error('PUT /api/reservations/[id] Error:', error);
    return NextResponse.json({ success: false, error: 'Fehler beim Aktualisieren der Reservierung' }, { status: 500 });
  }
}

// DELETE - Reservierung löschen
export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Ungültige ID' }, { status: 400 });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Keine Datenbank-Verbindung' }, { status: 503 });
    }
    const collection = db.collection('reservations');

    const reservation = await collection.findOne({ id });
    if (!reservation) {
      return NextResponse.json({ success: false, error: 'Reservierung nicht gefunden' }, { status: 404 });
    }

    const headerPwd = request.headers.get('x-deletion-password');
    if (reservation.deletionPasswordHash) {
      if (!headerPwd) {
        return NextResponse.json({ success: false, error: 'Löschpasswort erforderlich' }, { status: 403 });
      }
      if (String(headerPwd) !== GENERAL_PASSWORD) {
        const providedHash = crypto.createHash('sha256').update(String(headerPwd)).digest('hex');
        if (providedHash !== reservation.deletionPasswordHash) {
          return NextResponse.json({ success: false, error: 'Löschpasswort falsch' }, { status: 403 });
        }
      }
    }

    const result = await collection.deleteOne({ id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Reservierung nicht gefunden' }, { status: 404 });
    }

    try { emitReservationsChanged({ action: 'delete', id }); } catch (_) {}
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('DELETE /api/reservations/[id] Error:', error);
    return NextResponse.json({ success: false, error: 'Fehler beim Löschen der Reservierung' }, { status: 500 });
  }
}
