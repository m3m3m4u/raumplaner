import { getDb, getNextSequence } from '@/lib/mongodb';
import crypto from 'crypto';
import { initialReservations } from '@/lib/roomData';

// Allgemeines Admin/Override Passwort (Server-seitig). Setze z.B. ADMIN_GENERAL_PASSWORD in .env.local
// Frontend nutzt separat NEXT_PUBLIC_ADMIN_GENERAL_PASSWORD für UI-Prompts.
const GENERAL_PASSWORD = process.env.ADMIN_GENERAL_PASSWORD || process.env.ADMIN_PASSWORD || '872020';

function normalizeTimeString(value) {
  if (!value) return null;
  // Falls schon HH:MM
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(':').map(Number);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  // ISO oder anderes parsebares Datum
  const d = new Date(value);
  if (isNaN(d)) return null;
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function deriveDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0,10);
}

// GET - Alle Reservierungen abrufen
export async function GET() {
  try {
    console.log('Reservations GET: Starting...');
    const db = await getDb();
    
    if (!db) {
      console.log('Reservations GET: No database connection, returning initialReservations fallback');
      return Response.json({ success: true, data: initialReservations });
    }
    
    console.log('Reservations GET: Database connected, fetching data...');
    const collection = db.collection('reservations');

    let reservations = await collection
      .find({})
      .sort({ date: 1, startTime: 1 })
      .toArray();

    // Nachträgliche Normalisierung für ältere Datensätze
    reservations = reservations.map(r => {
      const needsDate = !r.date && r.startTime && r.startTime.includes('T');
      if (needsDate) {
        const date = deriveDate(r.startTime);
        const startNorm = normalizeTimeString(r.startTime);
        const endNorm = normalizeTimeString(r.endTime);
        return { ...r, date, startTime: startNorm, endTime: endNorm };
      }
      return r;
    });

  // Für Frontend: Falls startTime/endTime nur HH:MM + date enthalten, in voll qualifizierte ISO-DateTimes umwandeln
    const enriched = reservations.map(r => {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (r.date && timeRegex.test(r.startTime) && timeRegex.test(r.endTime)) {
        try {
          const [sh, sm] = r.startTime.split(':').map(Number);
          const [eh, em] = r.endTime.split(':').map(Number);
          // Lokales Datum verwenden
          const startDate = new Date(r.date + 'T' + r.startTime + ':00');
          const endDate = new Date(r.date + 'T' + r.endTime + ':00');
          // Nur wenn gültig, ersetzen – sonst Original belassen
          if (!isNaN(startDate) && !isNaN(endDate)) {
            return {
              ...r,
              startTime: startDate.toISOString(),
              endTime: endDate.toISOString(),
              _originalStart: r.startTime,
              _originalEnd: r.endTime
            };
          }
        } catch (_) {
          // Ignorieren – fallback auf Original
        }
      }
  // Entferne sensible Felder vor Ausgabe
  const safe = { ...r };
  safe.hasDeletionPassword = !!safe.deletionPasswordHash;
  delete safe.deletionPasswordHash;
  return safe;
    });

    console.log('Reservations GET: Found', enriched.length, 'reservations (enriched)');
    return Response.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Reservations GET Error:', error);
    return Response.json({ error: 'Fehler beim Laden der Reservierungen', details: error.message }, { status: 500 });
  }
}

// POST - Neue Reservierung erstellen
export async function POST(request) {
  try {
  const data = await request.json();
    console.log('POST Reservierung - Eingangsdaten:', data);
    
    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    const collection = db.collection('reservations');
    
    // roomId zu Integer konvertieren
    if (data.roomId) {
      data.roomId = parseInt(data.roomId, 10);
    }

    // Datum normalisieren - falls nicht vorhanden, von startTime ableiten
    if (!data.date && data.startTime) {
      const derived = deriveDate(data.startTime);
      if (derived) data.date = derived;
    }

    // Zeiten normalisieren (HH:MM)
    const startNorm = normalizeTimeString(data.startTime);
    const endNorm = normalizeTimeString(data.endTime);
    if (startNorm) data.startTime = startNorm;
    if (endNorm) data.endTime = endNorm;

    console.log('POST Reservierung - Nach Normalisierung:', data);

    const missing = [];
    if (!data.roomId || isNaN(data.roomId)) missing.push('roomId (gültige Zahl)');
    if (!data.title) missing.push('title');
    if (!data.startTime) missing.push('startTime');
    if (!data.endTime) missing.push('endTime');
    if (!data.date) missing.push('date');

    if (missing.length) {
      console.log('POST Reservierung - Fehlende Felder:', missing);
      return Response.json({ error: 'Fehlende Felder: ' + missing.join(', ') }, { status: 400 });
    }

    // Konfliktprüfung
    const conflict = await collection.findOne({
      roomId: data.roomId,
      date: data.date,
      $or: [
        { $and: [ { startTime: { $lte: data.startTime } }, { endTime: { $gt: data.startTime } } ] },
        { $and: [ { startTime: { $lt: data.endTime } }, { endTime: { $gte: data.endTime } } ] },
        { $and: [ { startTime: { $gte: data.startTime } }, { endTime: { $lte: data.endTime } } ] }
      ]
    });
    if (conflict) {
      return Response.json({ error: 'Der Raum ist zu dieser Zeit bereits reserviert' }, { status: 409 });
    }

    const newId = await getNextSequence(db, 'reservations');
    // ISO DateTimes für Frontend zusätzlich bereitstellen
    let isoStart = data.startTime;
    let isoEnd = data.endTime;
    const timeRegex = /^\d{2}:\d{2}$/;
    if (data.date && timeRegex.test(data.startTime) && timeRegex.test(data.endTime)) {
      isoStart = new Date(data.date + 'T' + data.startTime + ':00').toISOString();
      isoEnd = new Date(data.date + 'T' + data.endTime + ':00').toISOString();
    }

    const newReservation = {
      ...data,
      id: newId,
      startTime: isoStart,
      endTime: isoEnd,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  // Serien-Metadaten beibehalten falls mitgesendet (z.B. seriesId, seriesIndex, seriesTotal)
  // Validierung simpel belassen

    // Deletion password handling
    if (data.requireDeletionPassword) {
      const pwd = data.deletionPassword && String(data.deletionPassword).length > 0 ? String(data.deletionPassword) : '872020';
      const hash = crypto.createHash('sha256').update(pwd).digest('hex');
      newReservation.deletionPasswordHash = hash;
    }

    const result = await collection.insertOne(newReservation);
    if (!result.acknowledged) throw new Error('Insert fehlgeschlagen');

  // Do not return password hash
  const safeOut = { ...newReservation };
  safeOut.hasDeletionPassword = !!safeOut.deletionPasswordHash;
  delete safeOut.deletionPasswordHash;
  return Response.json({ success: true, data: safeOut }, { status: 201 });
  } catch (error) {
    console.error('Reservations POST Error:', error);
    return Response.json({ error: 'Fehler beim Erstellen der Reservierung', details: error.message }, { status: 500 });
  }
}

// PUT - Reservierung aktualisieren
export async function PUT(request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || null; // 'series-all' (später 'series-future') oder null
    const data = await request.json();
    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    const collection = db.collection('reservations');

    if (!data.id) {
      return Response.json({ error: 'ID ist erforderlich für Update' }, { status: 400 });
    }

    // Prüfe vorhandene Reservierung und ggf. Löschpasswort für Edit
    const existing = await collection.findOne({ id: data.id });
    if (!existing) return Response.json({ error: 'Reservierung nicht gefunden' }, { status: 404 });
    if (existing.deletionPasswordHash) {
      const headerPwd = request.headers.get('x-deletion-password');
      const bodyPwd = data.deletionPassword;
      const provided = headerPwd || bodyPwd;
      if (!provided) return Response.json({ error: 'Passwort zum Bearbeiten erforderlich' }, { status: 403 });
      // Override: akzeptiere Allgemein-Passwort direkt
      if (String(provided) !== GENERAL_PASSWORD) {
        const providedHash = crypto.createHash('sha256').update(String(provided)).digest('hex');
        if (providedHash !== existing.deletionPasswordHash) {
          return Response.json({ error: 'Passwort zum Bearbeiten falsch' }, { status: 403 });
        }
      }
    }

    // Ableitung / Normalisierung auch beim Update
    if (!data.date && data.startTime) {
      const derived = deriveDate(data.startTime);
      if (derived) data.date = derived;
    }
    const startNorm = normalizeTimeString(data.startTime);
    const endNorm = normalizeTimeString(data.endTime);
    if (startNorm) data.startTime = startNorm;
    if (endNorm) data.endTime = endNorm;

    if (data.roomId && data.date && data.startTime && data.endTime) {
      const conflict = await collection.findOne({
        id: { $ne: data.id },
        roomId: data.roomId,
        date: data.date,
        $or: [
          { $and: [ { startTime: { $lte: data.startTime } }, { endTime: { $gt: data.startTime } } ] },
            { $and: [ { startTime: { $lt: data.endTime } }, { endTime: { $gte: data.endTime } } ] },
            { $and: [ { startTime: { $gte: data.startTime } }, { endTime: { $lte: data.endTime } } ] }
        ]
      });
      if (conflict) {
        return Response.json({ error: 'Der Raum ist zu dieser Zeit bereits reserviert' }, { status: 409 });
      }
    }

    // ISO DateTimes berechnen (falls nötig)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (data.date && timeRegex.test(data.startTime) && timeRegex.test(data.endTime)) {
      data.startTime = new Date(data.date + 'T' + data.startTime + ':00').toISOString();
      data.endTime = new Date(data.date + 'T' + data.endTime + ':00').toISOString();
    }

    data.updatedAt = new Date().toISOString();

    // Handle deletion password updates explicitly
    const updateOps = { $set: { ...data } };
    // Remove deletionPassword from stored fields
    delete updateOps.$set.deletionPassword;
    delete updateOps.$set.requireDeletionPassword;

    if (typeof data.requireDeletionPassword !== 'undefined') {
      if (data.requireDeletionPassword) {
        const pwd = data.deletionPassword && String(data.deletionPassword).length > 0 ? String(data.deletionPassword) : '872020';
        const hash = crypto.createHash('sha256').update(pwd).digest('hex');
        updateOps.$set.deletionPasswordHash = hash;
      } else {
        // remove existing hash
        updateOps.$unset = { deletionPasswordHash: '' };
      }
    }

    let updatedDocs = [];
    if (scope && existing.seriesId) {
      // Serienweites Update: alle mit gleicher seriesId
      const filter = { seriesId: existing.seriesId };
      const multiUpdate = await collection.updateMany(filter, updateOps);
      if (multiUpdate.matchedCount === 0) {
        return Response.json({ error: 'Keine passenden Serien-Reservierungen gefunden' }, { status: 404 });
      }
      updatedDocs = await collection.find(filter).toArray();
    } else {
      const result = await collection.updateOne({ id: data.id }, updateOps);
      if (result.matchedCount === 0) {
        return Response.json({ error: 'Reservierung nicht gefunden' }, { status: 404 });
      }
      updatedDocs = [ await collection.findOne({ id: data.id }) ];
    }

    // Do not leak hash
    const out = { ...data };
    out.hasDeletionPassword = !!(updateOps.$set && updateOps.$set.deletionPasswordHash) || undefined;
    delete out.deletionPassword;
    delete out.deletionPasswordHash;
    delete out.requireDeletionPassword;
  return Response.json({ success: true, data: Array.isArray(out) ? out : (scope ? updatedDocs : out) });
  } catch (error) {
    console.error('Reservations PUT Error:', error);
    return Response.json({ error: 'Fehler beim Aktualisieren der Reservierung' }, { status: 500 });
  }
}

// DELETE - Reservierung löschen
export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id'));
    const scope = url.searchParams.get('scope'); // 'series-all' (später 'series-future')
    if (!id) return Response.json({ error: 'ID ist erforderlich für Löschung' }, { status: 400 });

    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    const collection = db.collection('reservations');
    const reservation = await collection.findOne({ id });
    if (!reservation) return Response.json({ error: 'Reservierung nicht gefunden' }, { status: 404 });

    // Check deletion password if set
    const headerPwd = request.headers.get('x-deletion-password');
    if (reservation.deletionPasswordHash) {
      if (!headerPwd) return Response.json({ error: 'Löschpasswort erforderlich' }, { status: 403 });
      // Allgemeines Passwort erlaubt sofort
      if (String(headerPwd) !== GENERAL_PASSWORD) {
        const providedHash = crypto.createHash('sha256').update(String(headerPwd)).digest('hex');
        if (providedHash !== reservation.deletionPasswordHash) {
          return Response.json({ error: 'Löschpasswort falsch' }, { status: 403 });
        }
      }
    }

    if (scope === 'series-all' && reservation.seriesId) {
      const seriesId = reservation.seriesId;
      const result = await collection.deleteMany({ seriesId });
      return Response.json({ success: true, deleted: result.deletedCount, seriesId });
    } else if (scope === 'time-future') {
      // Alle zukünftigen Termine, die zur gleichen Uhrzeit im gleichen Raum liegen (Datum ignoriert)
      const baseDate = reservation.date || deriveDate(reservation.startTime);
      const startHHMM = normalizeTimeString(reservation.startTime); // robust für HH:MM oder ISO
      const endHHMM = normalizeTimeString(reservation.endTime);
      const result = await collection.deleteMany({
        roomId: reservation.roomId,
        date: { $gte: baseDate },
        $and: [
          { $or: [ { startTime: startHHMM }, { startTime: { $regex: `T${startHHMM}:` } } ] },
          { $or: [ { endTime: endHHMM },   { endTime:   { $regex: `T${endHHMM}:` } } ] }
        ]
      });
      return Response.json({ success: true, deleted: result.deletedCount, scope: 'time-future', baseDate, roomId: reservation.roomId, start: startHHMM, end: endHHMM });
    } else {
      const result = await collection.deleteOne({ id });
      if (result.deletedCount === 0) {
        return Response.json({ error: 'Reservierung nicht gefunden' }, { status: 404 });
      }
      return Response.json({ success: true, id });
    }
  } catch (error) {
    console.error('Reservations DELETE Error:', error);
    return Response.json({ error: 'Fehler beim Löschen der Reservierung' }, { status: 500 });
  }
}
