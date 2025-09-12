// Beispieldaten für Räume und Reservierungen
// In einer echten Anwendung würden diese Daten aus einer Datenbank kommen

export const initialRooms = [
  {
    id: 1,
    name: "Klassenzimmer A101",
    capacity: 30,
    equipment: ["Smartboard", "Beamer", "Dokumentenkamera"],
    location: "1. Stock",
    description: "Großes Klassenzimmer mit moderner Technik"
  },
  {
    id: 2,
    name: "Klassenzimmer B205",
    capacity: 25,
    equipment: ["Whiteboard", "Beamer"],
    location: "2. Stock",
    description: "Standard Klassenzimmer"
  },
  {
    id: 3,
    name: "Physikraum C103",
    capacity: 20,
    equipment: ["Experimentierplätze", "Abzug", "Smartboard"],
    location: "1. Stock",
    description: "Speziell ausgestatteter Physikraum"
  },
  {
    id: 4,
    name: "Computerraum D301",
    capacity: 24,
    equipment: ["30 PCs", "Beamer", "Drucker"],
    location: "3. Stock",
    description: "Computerraum für IT-Unterricht"
  }
];

export const initialReservations = [
  {
    id: 1,
    roomId: 1,
    title: "Mathematik 10a",
    startTime: "2025-08-04T08:00:00",
    endTime: "2025-08-04T08:50:00",
    description: "Algebra und Gleichungen"
  },
  {
    id: 2,
    roomId: 1,
    title: "Deutsch 9b",
    startTime: "2025-08-04T08:50:00",
    endTime: "2025-08-04T09:15:00",
    description: "Gedichtanalyse - 1. Hälfte der Stunde"
  },
  {
    id: 3,
    roomId: 1,
    title: "Geschichte 8a",
    startTime: "2025-08-04T09:40:00",
    endTime: "2025-08-04T10:30:00",
    description: "Mittelalter - Feudalismus"
  },
  {
    id: 4,
    roomId: 1,
    title: "Englisch 7c",
    startTime: "2025-08-05T09:15:00",
    endTime: "2025-08-05T09:40:00",
    description: "Simple Past - 2. Hälfte der Stunde"
  },
  {
    id: 5,
    roomId: 1,
    title: "Biologie 9a",
    startTime: "2025-08-05T10:30:00",
    endTime: "2025-08-05T12:10:00",
    description: "Zellbiologie - Doppelstunde"
  },
  {
    id: 6,
    roomId: 2,
    title: "Physik 11a",
    startTime: "2025-08-05T08:00:00",
    endTime: "2025-08-05T08:50:00",
    description: "Mechanik - Kräfte und Bewegung"
  },
  {
    id: 7,
    roomId: 2,
    title: "Chemie 10b",
    startTime: "2025-08-05T08:50:00",
    endTime: "2025-08-05T09:40:00",
    description: "Säuren und Basen"
  },
  {
    id: 8,
    roomId: 3,
    title: "Sport 6a",
    startTime: "2025-08-04T13:00:00",
    endTime: "2025-08-04T13:50:00",
    description: "Volleyball - Grundlagen"
  },
  {
    id: 9,
    roomId: 4,
    title: "Informatik 12a",
    startTime: "2025-08-05T11:20:00",
    endTime: "2025-08-05T12:10:00",
    description: "Python Programmierung"
  },
  {
    id: 10,
    roomId: 1,
    title: "Klassenrat 8b",
    startTime: "2025-08-06T14:40:00",
    endTime: "2025-08-06T15:05:00",
    description: "Klassenorganisation - 1. Hälfte der Stunde"
  }
];

// Hilfsfunktionen für die Datenverwaltung
export const isRoomAvailable = (rooms, reservations, roomId, startTime, endTime, excludeReservationId = null) => {
  const roomReservations = reservations.filter(
    res => res.roomId === roomId && res.id !== excludeReservationId
  );
  
  return !roomReservations.some(reservation => {
    const resStart = new Date(reservation.startTime);
    const resEnd = new Date(reservation.endTime);
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    
    // Prüfen auf Überschneidungen
    return (newStart < resEnd && newEnd > resStart);
  });
};

export const getReservationsForDate = (reservations, date) => {
  return reservations.filter(reservation => {
    const resDate = new Date(reservation.startTime);
    return (
      resDate.getDate() === date.getDate() &&
      resDate.getMonth() === date.getMonth() &&
      resDate.getFullYear() === date.getFullYear()
    );
  });
};

export const getReservationsForRoom = (reservations, roomId) => {
  return reservations.filter(reservation => parseInt(reservation.roomId) === parseInt(roomId))
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
};
