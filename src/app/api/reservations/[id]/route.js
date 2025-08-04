import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const reservationsFile = path.join(dataDir, 'reservations.json');

function readReservations() {
  try {
    const data = fs.readFileSync(reservationsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeReservations(reservations) {
  try {
    fs.writeFileSync(reservationsFile, JSON.stringify(reservations, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

function isRoomAvailable(reservations, roomId, startTime, endTime, excludeId = null) {
  const roomReservations = reservations.filter(
    res => res.roomId === roomId && res.id !== excludeId
  );
  
  return !roomReservations.some(reservation => {
    const resStart = new Date(reservation.startTime);
    const resEnd = new Date(reservation.endTime);
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    
    return (newStart < resEnd && newEnd > resStart);
  });
}

// PUT - Reservierung aktualisieren
export async function PUT(request, { params }) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    const { roomId, title, startTime, endTime, organizer, attendees, description } = body;

    const reservations = readReservations();
    const reservationIndex = reservations.findIndex(r => r.id === id);
    
    if (reservationIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Reservierung nicht gefunden' },
        { status: 404 }
      );
    }

    // Validierung
    if (!roomId || !title || !startTime || !endTime || !organizer) {
      return NextResponse.json(
        { success: false, error: 'RaumID, Titel, Start-/Endzeit und Organisator sind erforderlich' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start >= end) {
      return NextResponse.json(
        { success: false, error: 'Endzeit muss nach der Startzeit liegen' },
        { status: 400 }
      );
    }

    // Verfügbarkeitsprüfung (ausgenommen die aktuelle Reservierung)
    if (!isRoomAvailable(reservations, parseInt(roomId), startTime, endTime, id)) {
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
      organizer,
      attendees: parseInt(attendees) || 0,
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

// DELETE - Reservierung löschen
export async function DELETE(request, { params }) {
  try {
    const id = parseInt(params.id);
    const reservations = readReservations();
    
    const reservationIndex = reservations.findIndex(r => r.id === id);
    
    if (reservationIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Reservierung nicht gefunden' },
        { status: 404 }
      );
    }

    const deletedReservation = reservations.splice(reservationIndex, 1)[0];

    if (writeReservations(reservations)) {
      return NextResponse.json({ success: true, data: deletedReservation });
    } else {
      return NextResponse.json(
        { success: false, error: 'Fehler beim Löschen der Reservierung' },
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
