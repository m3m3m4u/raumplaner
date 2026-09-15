import { getDb, getNextSequence } from '@/lib/mongodb';
import { emitReservationsChanged } from '@/lib/events';
import crypto from 'crypto';

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
  // Ermittele das lokale Datum (YYYY-MM-DD) aus einem Datum/ISO-String,
  // NICHT via toISOString (UTC), um Off-by-one-Tage zu vermeiden.
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d)) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// GET - Alle Reservierungen abrufen
export async function GET() {
  try {
    console.log('Reservations GET: Starting...');
    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    
    console.log('Reservations GET: Database connected, fetching data...');
    const collection = db.collection('reservations');

    let reservations = await collection
      .find({})
      .sort({ date: 1, startTime: 1 })
      .toArray();

    // Nachträgliche Normalisierung für ältere Datensätze
    reservations = reservations.map(r => {
      // roomId konsistent als Zahl halten
      if (typeof r.roomId === 'string') {
        const n = parseInt(r.roomId, 10);
        if (!isNaN(n)) r.roomId = n;
      }
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
      let r2 = { ...r };
      const timeRegex = /^\d{2}:\d{2}$/;
      if (r2.date && timeRegex.test(r2.startTime) && timeRegex.test(r2.endTime)) {
        try {
          const startDate = new Date(r2.date + 'T' + r2.startTime + ':00');
          const endDate = new Date(r2.date + 'T' + r2.endTime + ':00');
          if (!isNaN(startDate) && !isNaN(endDate)) {
            r2.startTime = startDate.toISOString();
            r2.endTime = endDate.toISOString();
            r2._originalStart = r.startTime;
            r2._originalEnd = r.endTime;
          }
        } catch (_) {
          // Ignorieren – fallback auf Original
        }
      }
      // Entferne sensible Felder vor Ausgabe
      const safe = { ...r2 };
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
    
    // BULK: Wenn ein Array gesendet wird, mehrere Reservierungen in einem Schwung anlegen
    if (Array.isArray(data)) {
      const db = await getDb();
      if (!db) {
        return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
      }
      const collection = db.collection('reservations');

      // Vor-Normalisierung und Basisvalidierung
      const items = data.map((raw, idx) => {
        const item = { ...raw };
        if (item.roomId) item.roomId = parseInt(item.roomId, 10);
        if (!item.date && item.startTime) {
          const derived = deriveDate(item.startTime);
          if (derived) item.date = derived;
        }
        const startNorm = normalizeTimeString(item.startTime);
        const endNorm = normalizeTimeString(item.endTime);
        if (startNorm) item.startTime = startNorm;
        if (endNorm) item.endTime = endNorm;
        const missing = [];
        if (!item.roomId || isNaN(item.roomId)) missing.push('roomId');
        if (!item.title) missing.push('title');
        if (!item.startTime) missing.push('startTime');
        if (!item.endTime) missing.push('endTime');
        if (!item.date) missing.push('date');
        return { idx, item, missing };
      });

      const failures = [];
      const valid = items.filter(x => {
        if (x.missing.length) {
          failures.push({ index: x.idx, title: x.item?.title || '', error: 'Fehlende Felder: ' + x.missing.join(', ') });
          return false;
        }
        return true;
      });

      // Gruppiere nach roomId+date -> ein Query pro Gruppe
      const keyOf = (o) => `${o.item.roomId}__${o.item.date}`;
      const groupsMap = new Map();
      for (const v of valid) {
        const k = keyOf(v);
        if (!groupsMap.has(k)) groupsMap.set(k, []);
        groupsMap.get(k).push(v);
      }

      const toInsert = [];
      const timeRegex = /^\d{2}:\d{2}$/;
      const toMin = (t) => {
        if (!t) return null;
        if (typeof t === 'string' && t.includes('T')) { const d = new Date(t); return isNaN(d) ? null : d.getHours()*60 + d.getMinutes(); }
        if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) { const [h,m] = t.split(':').map(Number); return h*60+m; }
        const d = new Date(t); return isNaN(d) ? null : d.getHours()*60 + d.getMinutes();
      };

      // Hole pro Gruppe existierende Tagesdokumente und führe Konfliktprüfung durch
      for (const [k, arr] of groupsMap.entries()) {
        const [roomIdStr, date] = k.split('__');
        const roomId = parseInt(roomIdStr, 10);
        const dayDocs = await collection.find({ roomId, date }).toArray();
        // bereits akzeptierte Kandidaten in dieser Gruppe (für interne Konflikte)
        const accepted = [];
        for (const v of arr) {
          const { item } = v;
          const newStartMin = toMin(item.startTime);
          const newEndMin = toMin(item.endTime);
          const conflictExisting = dayDocs.find(doc => {
            const s = toMin(doc.startTime); const e = toMin(doc.endTime);
            if (s == null || e == null || newStartMin == null || newEndMin == null) return false;
            return s < newEndMin && e > newStartMin;
          });
          if (conflictExisting) {
            failures.push({ index: v.idx, title: item.title, error: 'Zeitkonflikt mit bestehendem Termin' });
            continue;
          }
          const conflictAccepted = accepted.find(doc => {
            const s = toMin(doc._startTimeMin);
            const e = toMin(doc._endTimeMin);
            if (s == null || e == null || newStartMin == null || newEndMin == null) return false;
            return s < newEndMin && e > newStartMin;
          });
          if (conflictAccepted) {
            failures.push({ index: v.idx, title: item.title, error: 'Zeitkonflikt innerhalb des Batches' });
            continue;
          }
          // ID vergeben
          const newId = await getNextSequence(db, 'reservations');
          let isoStart = item.startTime;
          let isoEnd = item.endTime;
          if (item.date && timeRegex.test(item.startTime) && timeRegex.test(item.endTime)) {
            isoStart = new Date(item.date + 'T' + item.startTime + ':00').toISOString();
            isoEnd = new Date(item.date + 'T' + item.endTime + ':00').toISOString();
          }
          const newDoc = {
            ...item,
            id: newId,
            startTime: isoStart,
            endTime: isoEnd,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          if (item.requireDeletionPassword) {
            const pwd = item.deletionPassword && String(item.deletionPassword).length > 0 ? String(item.deletionPassword) : '872020';
            const hash = crypto.createHash('sha256').update(pwd).digest('hex');
            newDoc.deletionPasswordHash = hash;
          }
          // Für interne Konfliktprüfung Werte puffern
          newDoc._startTimeMin = newStartMin;
          newDoc._endTimeMin = newEndMin;
          toInsert.push({ idx: v.idx, title: item.title, doc: newDoc });
          accepted.push({ _startTimeMin: newStartMin, _endTimeMin: newEndMin });
        }
      }

      let successes = [];
      if (toInsert.length > 0) {
        try {
          const docs = toInsert.map(x => {
            const d = { ...x.doc };
            delete d._startTimeMin; delete d._endTimeMin;
            return d;
          });
          const result = await collection.insertMany(docs, { ordered: false });
          // Alle in toInsert gelten als erfolgreich, da IDs bereits vergeben
          successes = toInsert.map(x => ({ index: x.idx, id: x.doc.id, title: x.title }));
        } catch (err) {
          // Fallback: versuche einzeln, um Teilerfolge/Fehler zu erfassen
          console.warn('Bulk insertMany fehlgeschlagen, weiche auf Einzel-Inserts aus:', err?.message);
          for (const x of toInsert) {
            try {
              const d = { ...x.doc }; delete d._startTimeMin; delete d._endTimeMin;
              await collection.insertOne(d);
              successes.push({ index: x.idx, id: x.doc.id, title: x.title });
            } catch (e) {
              failures.push({ index: x.idx, title: x.title, error: e?.message || 'Insert fehlgeschlagen' });
            }
          }
        }
      }

  try { emitReservationsChanged({ action: 'bulk-insert', count: successes.length }); } catch (_) {}
  return Response.json({ success: true, bulk: true, insertedCount: successes.length, successes, failures }, { status: 201 });
    }
    
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

    if (typeof data.title === 'string') data.title = data.title.trim();
    if (typeof data.createdBy === 'string') data.createdBy = data.createdBy.trim();
    if (typeof data.description === 'string') data.description = data.description.trim();

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

    // Konfliktprüfung – robust per Minutenvergleich (unterstützt HH:MM und ISO in DB)
    const dayDocs = await collection.find({ roomId: data.roomId, date: data.date }).toArray();
    const toMin = (t) => {
      if (!t) return null;
      if (typeof t === 'string' && t.includes('T')) { const d = new Date(t); return isNaN(d) ? null : d.getHours()*60 + d.getMinutes(); }
      if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) { const [h,m] = t.split(':').map(Number); return h*60+m; }
      const d = new Date(t); return isNaN(d) ? null : d.getHours()*60 + d.getMinutes();
    };
    const newStartMin = toMin(data.startTime);
    const newEndMin = toMin(data.endTime);
    if (newStartMin !== null && newEndMin !== null && newStartMin >= newEndMin) {
      return Response.json({ error: 'Endzeit muss nach der Startzeit liegen' }, { status: 400 });
    }
    const conflictDoc = dayDocs.find(doc => {
      const s = toMin(doc.startTime); const e = toMin(doc.endTime);
      if (s == null || e == null || newStartMin == null || newEndMin == null) return false;
      return s < newEndMin && e > newStartMin;
    });
    if (conflictDoc) {
      return Response.json({ error: 'Der Raum ist zu dieser Zeit bereits reserviert', conflict: { id: conflictDoc.id, title: conflictDoc.title } }, { status: 409 });
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
  try { emitReservationsChanged({ action: 'insert', id: safeOut.id }); } catch (_) {}
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
    const data = await request.json();
    const scope = url.searchParams.get('scope') || data.scope || null; // 'series-all' | 'time-future' | null
    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    const collection = db.collection('reservations');

    if (!data.id) {
      return Response.json({ error: 'ID ist erforderlich für Update' }, { status: 400 });
    }

    // Robuste ID-Suche (Int oder String)
    const numId = parseInt(data.id, 10);
    const strId = String(data.id);
    const idQuery = !isNaN(numId) ? { $or: [{ id: numId }, { id: strId }] } : { id: strId };

    const existing = await collection.findOne(idQuery);
    if (!existing) return Response.json({ error: 'Reservierung nicht gefunden' }, { status: 404 });

    // Prüfe vorhandene Reservierung und ggf. Löschpasswort für Edit
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

    if (typeof data.title === 'string') data.title = data.title.trim();
    if (typeof data.createdBy === 'string') data.createdBy = data.createdBy.trim();
    if (typeof data.description === 'string') data.description = data.description.trim();

    if (data.roomId && data.date && data.startTime && data.endTime) {
      // Robuste Konfliktprüfung beim Update
      // Exclude dieselbe Reservierung (über _id und id) sowie bei Serien alle Termine der Serie
      const excludeFilter = [
        { _id: { $ne: existing._id } }
      ];
      if (!isNaN(numId)) excludeFilter.push({ id: { $ne: numId } });
      excludeFilter.push({ id: { $ne: strId } });
      if (scope === 'series-all' && existing.seriesId) {
        excludeFilter.push({ seriesId: { $ne: existing.seriesId } });
      }

      const dayDocs = await collection.find({
        roomId: parseInt(data.roomId, 10),
        date: data.date,
        $and: excludeFilter
      }).toArray();

      const toMin = (t) => {
        if (!t) return null;
        if (typeof t === 'string' && t.includes('T')) { const d = new Date(t); return isNaN(d) ? null : d.getHours()*60 + d.getMinutes(); }
        if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) { const [h,m] = t.split(':').map(Number); return h*60+m; }
        const d = new Date(t); return isNaN(d) ? null : d.getHours()*60 + d.getMinutes();
      };
      const newStartMin = toMin(data.startTime);
      const newEndMin = toMin(data.endTime);
      if (newStartMin !== null && newEndMin !== null && newStartMin >= newEndMin) {
        return Response.json({ error: 'Endzeit muss nach der Startzeit liegen' }, { status: 400 });
      }
      const conflictDoc = dayDocs.find(doc => {
        const s = toMin(doc.startTime); const e = toMin(doc.endTime);
        if (s == null || e == null || newStartMin == null || newEndMin == null) return false;
        return s < newEndMin && e > newStartMin;
      });
      if (conflictDoc) {
        return Response.json({ error: 'Der Raum ist zu dieser Zeit bereits reserviert', conflict: { id: conflictDoc.id, title: conflictDoc.title } }, { status: 409 });
      }
    }

    data.updatedAt = new Date().toISOString();

    // Handle deletion password updates explicitly
    const updateOps = { $set: { ...data } };
    delete updateOps.$set.deletionPassword;
    delete updateOps.$set.requireDeletionPassword;
    delete updateOps.$set.id;
    delete updateOps.$set._id;
    delete updateOps.$set.scope;

    if (typeof data.requireDeletionPassword !== 'undefined') {
      if (data.requireDeletionPassword) {
        const pwd = data.deletionPassword && String(data.deletionPassword).length > 0 ? String(data.deletionPassword) : '872020';
        const hash = crypto.createHash('sha256').update(pwd).digest('hex');
        updateOps.$set.deletionPasswordHash = hash;
      } else {
        updateOps.$unset = { deletionPasswordHash: '' };
      }
    }

    let updatedDocs = [];
    if (scope === 'series-all' && existing.seriesId) {
      // Serienweites Update: Behalte Datum für jeden Termin bei, passe Uhrzeit an
      const seriesDocs = await collection.find({ seriesId: existing.seriesId }).toArray();
      if (seriesDocs.length === 0) {
        return Response.json({ error: 'Keine passenden Serien-Reservierungen gefunden' }, { status: 404 });
      }
      for (const doc of seriesDocs) {
        const docSet = {
          updatedAt: new Date().toISOString()
        };
        if (data.title) {
          if (doc.seriesIndex && doc.seriesTotal) {
            const cleanTitle = data.title.replace(/ \(Woche \d+\/\d+\)/, '');
            docSet.title = `${cleanTitle} (Woche ${doc.seriesIndex}/${doc.seriesTotal})`;
          } else {
            docSet.title = data.title;
          }
        }
        if (typeof data.description !== 'undefined') docSet.description = data.description;
        if (data.roomId) docSet.roomId = parseInt(data.roomId, 10);
        const targetDate = doc.date || deriveDate(doc.startTime);
        if (startNorm && endNorm && targetDate) {
          docSet.startTime = new Date(targetDate + 'T' + startNorm + ':00').toISOString();
          docSet.endTime = new Date(targetDate + 'T' + endNorm + ':00').toISOString();
          docSet.date = targetDate;
        }
        if (updateOps.$set.deletionPasswordHash) {
          docSet.deletionPasswordHash = updateOps.$set.deletionPasswordHash;
        }

        const op = { $set: docSet };
        if (updateOps.$unset?.deletionPasswordHash) {
          op.$unset = { deletionPasswordHash: '' };
        }
        await collection.updateOne({ _id: doc._id }, op);
      }
      updatedDocs = await collection.find({ seriesId: existing.seriesId }).toArray();
    } else if (scope === 'time-future') {
      // Future-only Update
      const baseDate = existing.date || deriveDate(existing.startTime);
      const oldStartHHMM = normalizeTimeString(existing.startTime);
      const oldEndHHMM = normalizeTimeString(existing.endTime);
      const filter = {
        roomId: existing.roomId,
        date: { $gte: baseDate },
        $and: [
          { $or: [ { startTime: oldStartHHMM }, { startTime: { $regex: `T${oldStartHHMM}:` } } ] },
          { $or: [ { endTime: oldEndHHMM },   { endTime:   { $regex: `T${oldEndHHMM}:` } } ] }
        ]
      };
      const futureDocs = await collection.find(filter).toArray();
      for (const doc of futureDocs) {
        const docSet = { updatedAt: new Date().toISOString() };
        if (data.title) docSet.title = data.title;
        if (typeof data.description !== 'undefined') docSet.description = data.description;
        if (data.roomId) docSet.roomId = parseInt(data.roomId, 10);
        if (startNorm && endNorm && doc.date) {
          docSet.startTime = new Date(doc.date + 'T' + startNorm + ':00').toISOString();
          docSet.endTime = new Date(doc.date + 'T' + endNorm + ':00').toISOString();
        }
        if (updateOps.$set.deletionPasswordHash) {
          docSet.deletionPasswordHash = updateOps.$set.deletionPasswordHash;
        }
        const op = { $set: docSet };
        if (updateOps.$unset?.deletionPasswordHash) {
          op.$unset = { deletionPasswordHash: '' };
        }
        await collection.updateOne({ _id: doc._id }, op);
      }
      updatedDocs = await collection.find(filter).toArray();
    } else {
      // Einzel-Termin Update
      let isoStart = data.startTime;
      let isoEnd = data.endTime;
      const timeRegex = /^\d{2}:\d{2}$/;
      if (data.date && timeRegex.test(data.startTime) && timeRegex.test(data.endTime)) {
        isoStart = new Date(data.date + 'T' + data.startTime + ':00').toISOString();
        isoEnd = new Date(data.date + 'T' + data.endTime + ':00').toISOString();
      }
      updateOps.$set.startTime = isoStart;
      updateOps.$set.endTime = isoEnd;
      if (data.roomId) updateOps.$set.roomId = parseInt(data.roomId, 10);

      await collection.updateOne({ _id: existing._id }, updateOps);
      updatedDocs = [ await collection.findOne({ _id: existing._id }) ];
    }

    // Sensitive Felder entfernen
    const sanitize = (doc) => {
      if (!doc) return doc;
      const safe = { ...doc };
      safe.hasDeletionPassword = !!safe.deletionPasswordHash;
      delete safe.deletionPasswordHash;
      return safe;
    };
    const sanitized = Array.isArray(updatedDocs) ? updatedDocs.map(sanitize) : sanitize(updatedDocs);
    try { emitReservationsChanged({ action: 'update', count: Array.isArray(sanitized) ? sanitized.length : 1 }); } catch (_) {}
    return Response.json({ success: true, data: sanitized });
  } catch (error) {
    console.error('Reservations PUT Error:', error);
    return Response.json({ error: 'Fehler beim Aktualisieren der Reservierung', details: error.message }, { status: 500 });
  }
}

// DELETE - Reservierung löschen
export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const rawId = url.searchParams.get('id');
    const id = parseInt(rawId, 10);
    const scope = url.searchParams.get('scope'); // 'series-all' (später 'series-future')
    if (!rawId) return Response.json({ error: 'ID ist erforderlich für Löschung' }, { status: 400 });

    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    const collection = db.collection('reservations');
    const idQuery = !isNaN(id) ? { $or: [{ id }, { id: String(rawId) }] } : { id: String(rawId) };
    const reservation = await collection.findOne(idQuery);
    if (!reservation) {
      console.warn('DELETE: Reservierung mit ID nicht gefunden:', rawId);
      return Response.json({ error: 'Reservierung nicht gefunden' }, { status: 404 });
    }

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
      try { emitReservationsChanged({ action: 'delete-series', deleted: result.deletedCount }); } catch (_) {}
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
      try { emitReservationsChanged({ action: 'delete-future', deleted: result.deletedCount }); } catch (_) {}
      return Response.json({ success: true, deleted: result.deletedCount, scope: 'time-future', baseDate, roomId: reservation.roomId, start: startHHMM, end: endHHMM });
    } else {
      const result = await collection.deleteOne({ _id: reservation._id });
      if (result.deletedCount === 0) {
        return Response.json({ error: 'Reservierung nicht gefunden' }, { status: 404 });
      }
      try { emitReservationsChanged({ action: 'delete', id: reservation.id }); } catch (_) {}
      return Response.json({ success: true, id: reservation.id });
    }
  } catch (error) {
    console.error('Reservations DELETE Error:', error);
    return Response.json({ error: 'Fehler beim Löschen der Reservierung' }, { status: 500 });
  }
}
