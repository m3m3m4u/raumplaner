import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Pfad zur JSON-Datei
const dataDir = path.join(process.cwd(), 'data');
const roomsFile = path.join(dataDir, 'rooms.json');

// Initialisiere Datenordner falls nicht vorhanden
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialisiere rooms.json mit Beispieldaten falls nicht vorhanden
if (!fs.existsSync(roomsFile)) {
  const initialRooms = [
    {
      id: 1,
      name: "Konferenzraum A",
      capacity: 12,
      equipment: ["Beamer", "Whiteboard", "Videokonferenz"],
      location: "1. Stock",
      description: "Großer Konferenzraum mit modernster Technik",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      name: "Besprechungsraum B",
      capacity: 6,
      equipment: ["TV-Display", "Whiteboard"],
      location: "Erdgeschoss",
      description: "Kleiner Besprechungsraum für Teamrunden",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 3,
      name: "Seminarraum C",
      capacity: 20,
      equipment: ["Beamer", "Flipchart", "Sound-System"],
      location: "2. Stock",
      description: "Großer Raum für Seminare und Schulungen",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 4,
      name: "Arbeitsraum D",
      capacity: 4,
      equipment: ["TV-Display"],
      location: "1. Stock",
      description: "Ruhiger Raum für konzentriertes Arbeiten",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  fs.writeFileSync(roomsFile, JSON.stringify(initialRooms, null, 2));
}

// Hilfsfunktionen
function readRooms() {
  try {
    const data = fs.readFileSync(roomsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Fehler beim Lesen der Räume:', error);
    return [];
  }
}

function writeRooms(rooms) {
  try {
    fs.writeFileSync(roomsFile, JSON.stringify(rooms, null, 2));
    return true;
  } catch (error) {
    console.error('Fehler beim Schreiben der Räume:', error);
    return false;
  }
}

// GET - Alle Räume abrufen
export async function GET() {
  try {
    const rooms = readRooms();
    return NextResponse.json(rooms); // Direkt das Array zurückgeben
  } catch (error) {
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Räume' },
      { status: 500 }
    );
  }
}

// POST - Neuen Raum erstellen
export async function POST(request) {
  try {
    const body = await request.json();
    const { name } = body;

    // Validierung
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Raumname ist erforderlich' },
        { status: 400 }
      );
    }

    const rooms = readRooms();
    
    // Neue ID generieren
    const newId = rooms.length > 0 ? Math.max(...rooms.map(r => r.id)) + 1 : 1;
    
    const newRoom = {
      id: newId,
      name: name.trim(),
      description: body.description || '',
      equipment: body.equipment || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    rooms.push(newRoom);
    
    if (writeRooms(rooms)) {
      return NextResponse.json(newRoom, { status: 201 });
    } else {
      return NextResponse.json(
        { error: 'Fehler beim Speichern des Raums' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Ungültige Anfrage' },
    );
  }
}

// PUT - Raum aktualisieren
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, description, equipment } = body;

    // Validierung
    if (!id || !name || !name.trim()) {
      return NextResponse.json(
        { error: 'ID und Raumname sind erforderlich' },
        { status: 400 }
      );
    }

    const rooms = readRooms();
    const roomIndex = rooms.findIndex(r => r.id === parseInt(id));
    
    if (roomIndex === -1) {
      return NextResponse.json(
        { error: 'Raum nicht gefunden' },
        { status: 404 }
      );
    }

    // Raum aktualisieren
    rooms[roomIndex] = {
      ...rooms[roomIndex],
      name: name.trim(),
      description: description || '',
      equipment: equipment || [],
      updatedAt: new Date().toISOString()
    };
    
    if (writeRooms(rooms)) {
      return NextResponse.json(rooms[roomIndex]);
    } else {
      return NextResponse.json(
        { error: 'Fehler beim Speichern des Raums' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Ungültige Anfrage' },
    );
  }
}

// DELETE - Raum löschen
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Raum-ID ist erforderlich' },
        { status: 400 }
      );
    }

    const rooms = readRooms();
    const roomIndex = rooms.findIndex(r => r.id === parseInt(id));
    
    if (roomIndex === -1) {
      return NextResponse.json(
        { error: 'Raum nicht gefunden' },
        { status: 404 }
      );
    }

    // Raum aus Array entfernen
    const deletedRoom = rooms.splice(roomIndex, 1)[0];
    
    if (writeRooms(rooms)) {
      return NextResponse.json({ 
        message: 'Raum erfolgreich gelöscht',
        deletedRoom: deletedRoom
      });
    } else {
      return NextResponse.json(
        { error: 'Fehler beim Speichern der Änderungen' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Ungültige Anfrage' },
      { status: 400 }
    );
  }
}
