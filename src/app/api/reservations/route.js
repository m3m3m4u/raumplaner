import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Pfad zur JSON-Datei
const dataDir = path.join(process.cwd(), 'data');
const reservationsFile = path.join(dataDir, 'reservations.json');

// Initialisiere reservations.json mit Beispieldaten falls nicht vorhanden
if (!fs.existsSync(reservationsFile)) {
  const initialReservations = [
    {
      id: 1,
      roomId: 1,
      title: "Projektbesprechung Alpha",
      startTime: new Date(2025, 7, 4, 9, 0).toISOString(),
      endTime: new Date(2025, 7, 4, 10, 30).toISOString(),
      organizer: "Max Mustermann",
      attendees: 8,
      description: "Wöchentliche Projektbesprechung",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      roomId: 2,
      title: "Team Standup",
      startTime: new Date(2025, 7, 4, 14, 0).toISOString(),
      endTime: new Date(2025, 7, 4, 14, 30).toISOString(),
      organizer: "Anna Schmidt",
      attendees: 5,
      description: "Tägliches Team-Meeting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 3,
      roomId: 3,
      title: "Schulung: Neue Software",
      startTime: new Date(2025, 7, 5, 9, 0).toISOString(),
      endTime: new Date(2025, 7, 5, 16, 0).toISOString(),
      organizer: "HR-Abteilung",
      attendees: 15,
      description: "Ganztägige Schulung für alle Mitarbeiter",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  fs.writeFileSync(reservationsFile, JSON.stringify(initialReservations, null, 2));
}

// Hilfsfunktionen
function readReservations() {
  try {
    const data = fs.readFileSync(reservationsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Fehler beim Lesen der Reservierungen:', error);
    return [];
  }
}

function writeReservations(reservations) {
  try {
    fs.writeFileSync(reservationsFile, JSON.stringify(reservations, null, 2));
    return true;
  } catch (error) {
    console.error('Fehler beim Schreiben der Reservierungen:', error);
    return false;
  }
}

// Verfügbarkeitsprüfung
function isRoomAvailable(reservations, roomId, startTime, endTime, excludeId = null) {
  const roomReservations = reservations.filter(
    res => res.roomId === roomId && res.id !== excludeId
  );
  
  return !roomReservations.some(reservation => {
    const resStart = new Date(reservation.startTime);
    const resEnd = new Date(reservation.endTime);
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    
    // Prüfen auf Überschneidungen
    return (newStart < resEnd && newEnd > resStart);
  });
}

// GET - Alle Reservierungen abrufen
export async function GET() {
  try {
    const reservations = readReservations();
    return NextResponse.json({ success: true, data: reservations });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Fehler beim Abrufen der Reservierungen' },
      { status: 500 }
    );
  }
}

// POST - Neue Reservierung erstellen
export async function POST(request) {
  try {
    const body = await request.json();
    const { roomId, title, startTime, endTime, organizer, attendees, description } = body;

    // Validierung
    if (!roomId || !title || !startTime || !endTime || !organizer) {
      return NextResponse.json(
        { success: false, error: 'RaumID, Titel, Start-/Endzeit und Organisator sind erforderlich' },
        { status: 400 }
      );
    }

    // Zeitvalidierung
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start > end) {
      return NextResponse.json(
        { success: false, error: 'Endzeit muss nach oder gleich der Startzeit liegen' },
        { status: 400 }
      );
    }

    const reservations = readReservations();
    
    // Verfügbarkeitsprüfung
    if (!isRoomAvailable(reservations, parseInt(roomId), startTime, endTime)) {
      return NextResponse.json(
        { success: false, error: 'Raum ist zu dieser Zeit bereits reserviert' },
        { status: 409 }
      );
    }
    
    // Neue ID generieren
    const newId = reservations.length > 0 ? Math.max(...reservations.map(r => r.id)) + 1 : 1;
    
    const newReservation = {
      id: newId,
      roomId: parseInt(roomId),
      title,
      startTime,
      endTime,
      organizer,
      attendees: parseInt(attendees) || 0,
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    reservations.push(newReservation);
    
    if (writeReservations(reservations)) {
      return NextResponse.json({ success: true, data: newReservation }, { status: 201 });
    } else {
      return NextResponse.json(
        { success: false, error: 'Fehler beim Speichern der Reservierung' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Ungültige Anfrage' },
      { status: 400 }
    );
  }
}

// PUT - Reservierung aktualisieren
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, roomId, title, startTime, endTime, organizer, attendees, description } = body;

    if (!id || !roomId || !title || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'ID, roomId, title, startTime und endTime sind erforderlich' },
        { status: 400 }
      );
    }

    const reservations = readReservations();
    const reservationIndex = reservations.findIndex(r => r.id === parseInt(id));
    
    if (reservationIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Reservierung nicht gefunden' },
        { status: 404 }
      );
    }

    // Verfügbarkeitsprüfung (ohne die zu bearbeitende Reservierung)
    if (!isRoomAvailable(reservations, parseInt(roomId), startTime, endTime, parseInt(id))) {
      return NextResponse.json(
        { success: false, error: 'Raum ist zu dieser Zeit bereits reserviert' },
        { status: 409 }
      );
    }

    // Reservierung aktualisieren
    reservations[reservationIndex] = {
      ...reservations[reservationIndex],
      roomId: parseInt(roomId),
      title,
      startTime,
      endTime,
      organizer: organizer || reservations[reservationIndex].organizer,
      attendees: parseInt(attendees) || reservations[reservationIndex].attendees,
      description: description || '',
      updatedAt: new Date().toISOString()
    };
    
    if (writeReservations(reservations)) {
      return NextResponse.json({ success: true, data: reservations[reservationIndex] });
    } else {
      return NextResponse.json(
        { success: false, error: 'Fehler beim Speichern der Reservierung' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Ungültige Anfrage' },
      { status: 400 }
    );
  }
}
