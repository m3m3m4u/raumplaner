// Entfernt: initialRooms und initialReservations – alle Daten kommen aus der DB

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
