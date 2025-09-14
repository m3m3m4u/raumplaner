import { getDb } from '@/lib/mongodb';

// GET - Schedule abrufen
export async function GET() {
  try {
    const db = await getDb();
    if (!db) {
      return Response.json({ error: 'Keine Datenbank-Verbindung. Bitte MONGODB_URI und MONGODB_DB konfigurieren.' }, { status: 503 });
    }
    const collection = db.collection('schedule');
    
    const schedule = await collection.find({}).sort({ id: 1 }).toArray();
    
    // Wenn keine Daten vorhanden, einfach leeres Array zurückgeben (kein Auto-Insert)
    if (schedule.length === 0) {
      return Response.json([]);
    }
    
    return Response.json(schedule);
  } catch (error) {
    console.error('Schedule GET Error:', error);
    return Response.json(
      { error: 'Fehler beim Laden der Schedule-Daten' }, 
      { status: 500 }
    );
  }
}

// POST - Neue Schedule-Periode hinzufügen
export async function POST(request) {
  try {
    const data = await request.json();
    const db = await getDb();
    const collection = db.collection('schedule');
    
    // Prüfen, ob ID bereits existiert
    if (data.id) {
      const existing = await collection.findOne({ id: data.id });
      if (existing) {
        return Response.json(
          { error: 'Schedule-Periode mit dieser ID existiert bereits' },
          { status: 400 }
        );
      }
    } else {
      // Neue ID generieren wenn nicht vorhanden
      const maxDoc = await collection.findOne({}, { sort: { id: -1 } });
      data.id = maxDoc ? maxDoc.id + 1 : 1;
    }
    
    // Validierung
    if (!data.name || !data.startTime || !data.endTime) {
      return Response.json(
        { error: 'Name, Startzeit und Endzeit sind erforderlich' },
        { status: 400 }
      );
    }
    
    const result = await collection.insertOne(data);
    
    if (result.acknowledged) {
      return Response.json(data, { status: 201 });
    } else {
      throw new Error('Insert fehlgeschlagen');
    }
    
  } catch (error) {
    console.error('Schedule POST Error:', error);
    return Response.json(
      { error: 'Fehler beim Erstellen der Schedule-Periode' },
      { status: 500 }
    );
  }
}

// PUT - Schedule-Periode aktualisieren
export async function PUT(request) {
  try {
    const data = await request.json();
    const db = await getDb();
    const collection = db.collection('schedule');
    
    if (!data.id) {
      return Response.json(
        { error: 'ID ist erforderlich für Update' },
        { status: 400 }
      );
    }
    
    // Validierung
    if (!data.name || !data.startTime || !data.endTime) {
      return Response.json(
        { error: 'Name, Startzeit und Endzeit sind erforderlich' },
        { status: 400 }
      );
    }
    
    const result = await collection.updateOne(
      { id: data.id },
      { $set: data }
    );
    
    if (result.matchedCount === 0) {
      return Response.json(
        { error: 'Schedule-Periode nicht gefunden' },
        { status: 404 }
      );
    }
    
    return Response.json(data);
    
  } catch (error) {
    console.error('Schedule PUT Error:', error);
    return Response.json(
      { error: 'Fehler beim Aktualisieren der Schedule-Periode' },
      { status: 500 }
    );
  }
}

// DELETE - Schedule-Periode löschen
export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id'));
    
    if (!id) {
      return Response.json(
        { error: 'ID ist erforderlich für Löschung' },
        { status: 400 }
      );
    }
    
    const db = await getDb();
    const collection = db.collection('schedule');
    
    const result = await collection.deleteOne({ id });
    
    if (result.deletedCount === 0) {
      return Response.json(
        { error: 'Schedule-Periode nicht gefunden' },
        { status: 404 }
      );
    }
    
    return Response.json({ success: true, id });
    
  } catch (error) {
    console.error('Schedule DELETE Error:', error);
    return Response.json(
      { error: 'Fehler beim Löschen der Schedule-Periode' },
      { status: 500 }
    );
  }
}
