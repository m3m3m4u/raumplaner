import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Pfad zur JSON-Datei
const dataDir = path.join(process.cwd(), 'data');
const reservationsFile = path.join(dataDir, 'reservations.json');

// Initialisiere Datenordner falls nicht vorhanden
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readReservations() {
  try {
    if (!fs.existsSync(reservationsFile)) {
      return [];
    }
    const data = fs.readFileSync(reservationsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Fehler beim Lesen der Reservierungen:', error);
    return [];
  }
}

// POST - Prüfe Zeitkonflikte
export async function POST(request) {
  try {
    const body = await request.json();
    const { roomId, startTime, endTime, excludeId } = body;

    if (!roomId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'roomId, startTime und endTime sind erforderlich' },
        { status: 400 }
      );
    }

    const reservations = readReservations();
    
    // Filtere Reservierungen für den gleichen Raum (außer der zu bearbeitenden)
    const roomReservations = reservations.filter(res => 
      res.roomId === parseInt(roomId) && 
      (!excludeId || res.id !== parseInt(excludeId))
    );

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    // Prüfe auf Überschneidungen
    const conflicts = roomReservations.filter(reservation => {
      const existingStart = new Date(reservation.startTime);
      const existingEnd = new Date(reservation.endTime);

      // Prüfe ob sich die Zeiten überschneiden
      return (
        (newStart < existingEnd && newEnd > existingStart) // Überschneidung
      );
    });

    if (conflicts.length > 0) {
      // Formatiere Konfliktinformationen
      const conflictInfo = conflicts.map(conflict => ({
        id: conflict.id,
        title: conflict.title,
        startTime: conflict.startTime,
        endTime: conflict.endTime,
        timeDisplay: `${new Date(conflict.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - ${new Date(conflict.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
      }));

      return NextResponse.json({
        hasConflict: true,
        conflicts: conflictInfo
      });
    }

    return NextResponse.json({
      hasConflict: false,
      conflicts: []
    });

  } catch (error) {
    console.error('Fehler bei Konfliktprüfung:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Konfliktprüfung' },
      { status: 500 }
    );
  }
}
