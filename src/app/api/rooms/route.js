import { getDb } from '@/lib/mongodb';
import { initialRooms } from '@/lib/roomData';

// GET - Alle Räume abrufen
export async function GET() {
  try {
    console.log('Rooms GET: Starting...');
    const db = await getDb();
    
    if (!db) {
      console.log('Rooms GET: No database connection, returning initialRooms fallback');
      // Alphabetisch nach Name sortieren (deutsche Sortierung)
      const sorted = [...initialRooms].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de', { sensitivity: 'base' }));
      return Response.json(sorted);
    }
    
    console.log('Rooms GET: Database connected, fetching data...');
    const collection = db.collection('rooms');
    // Nach Name sortieren; Kollation für deutsche Sortierung
    const rooms = await collection
      .find({})
      .collation({ locale: 'de', strength: 1 })
      .sort({ name: 1 })
      .toArray();
    
    console.log('Rooms GET: Found', rooms.length, 'rooms');
    return Response.json(rooms);
  } catch (error) {
    console.error('Rooms GET Error:', error);
    return Response.json({ error: 'Fehler beim Laden der Räume', details: error.message }, { status: 500 });
  }
}

// POST - Neuen Raum hinzufügen
export async function POST(request) {
  try {
    const data = await request.json();
    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    const collection = db.collection('rooms');

    if (data.id) {
      const existing = await collection.findOne({ id: data.id });
      if (existing) {
        return Response.json({ error: 'Raum mit dieser ID existiert bereits' }, { status: 400 });
      }
    } else {
      const maxDoc = await collection.findOne({}, { sort: { id: -1 } });
      data.id = maxDoc ? maxDoc.id + 1 : 1;
    }
    if (!data.name) {
      return Response.json({ error: 'Raumname ist erforderlich' }, { status: 400 });
    }
    // Normalisierung
    if (data.capacity !== undefined && data.capacity !== null && data.capacity !== '') {
      const cap = parseInt(data.capacity);
      if (!isNaN(cap) && cap >= 0) data.capacity = cap; else delete data.capacity;
    } else {
      delete data.capacity;
    }
    if (typeof data.location === 'string') data.location = data.location.trim();
    if (data.location === '') delete data.location;

    const result = await collection.insertOne(data);
    if (!result.acknowledged) throw new Error('Insert fehlgeschlagen');
    return Response.json(data, { status: 201 });
  } catch (error) {
    console.error('Rooms POST Error:', error);
    return Response.json({ error: 'Fehler beim Erstellen des Raums' }, { status: 500 });
  }
}

// PUT - Raum aktualisieren
export async function PUT(request) {
  try {
    const data = await request.json();
    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    const collection = db.collection('rooms');
    if (!data.id) {
      return Response.json({ error: 'ID ist erforderlich für Update' }, { status: 400 });
    }
    // Normalisierung
    if (data.capacity !== undefined) {
      if (data.capacity === '' || data.capacity === null) {
        delete data.capacity;
      } else {
        const cap = parseInt(data.capacity);
        if (!isNaN(cap) && cap >= 0) data.capacity = cap; else delete data.capacity;
      }
    }
    if (typeof data.location === 'string') {
      data.location = data.location.trim();
      if (data.location === '') delete data.location;
    }

    const result = await collection.updateOne({ id: data.id }, { $set: data });
    if (result.matchedCount === 0) {
      return Response.json({ error: 'Raum nicht gefunden' }, { status: 404 });
    }
    return Response.json(data);
  } catch (error) {
    console.error('Rooms PUT Error:', error);
    return Response.json({ error: 'Fehler beim Aktualisieren des Raums' }, { status: 500 });
  }
}

// DELETE - Raum löschen
export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id'));
    if (!id) return Response.json({ error: 'ID ist erforderlich für Löschung' }, { status: 400 });
    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    const collection = db.collection('rooms');
    const result = await collection.deleteOne({ id });
    if (result.deletedCount === 0) {
      return Response.json({ error: 'Raum nicht gefunden' }, { status: 404 });
    }
    // Cascade: zugehörige Reservierungen löschen
    try {
      await db.collection('reservations').deleteMany({ roomId: id });
    } catch (e) {
      console.warn('Cascade delete reservations failed:', e.message);
    }
    return Response.json({ success: true, id });
  } catch (error) {
    console.error('Rooms DELETE Error:', error);
    return Response.json({ error: 'Fehler beim Löschen des Raums' }, { status: 500 });
  }
}
