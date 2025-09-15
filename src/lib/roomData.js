// Entfernt: initialRooms und initialReservations – alle Daten kommen aus der DB

// Hilfsfunktionen für die Datenverwaltung

// Rekonstruiert eine lokale DateTime aus reservation.date (YYYY-MM-DD)
// und Start/Ende (ISO oder HH:MM), um Zeitzonenverschiebungen zu vermeiden.
export const getLocalDateTime = (reservation, which = 'start') => {
  try {
    const dateStr = reservation?.date;
    const tStr = which === 'end' ? reservation?.endTime : reservation?.startTime;
    if (!dateStr || !tStr) return null;
    const [y, m, d] = String(dateStr).split('-').map(Number);
    let hh = 0, mm = 0;
    if (typeof tStr === 'string' && tStr.includes('T')) {
      // ISO: als lokale Uhrzeit interpretieren
      const dt = new Date(tStr);
      if (!isNaN(dt)) { hh = dt.getHours(); mm = dt.getMinutes(); }
    } else if (typeof tStr === 'string' && /^\d{1,2}:\d{2}$/.test(tStr)) {
      const [h, m2] = tStr.split(':').map(Number);
      hh = h; mm = m2;
    } else {
      const dt = new Date(tStr);
      if (!isNaN(dt)) { hh = dt.getHours(); mm = dt.getMinutes(); }
    }
    return new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
  } catch (_) { return null; }
};
export const isRoomAvailable = (rooms, reservations, roomId, startTime, endTime, excludeReservationId = null) => {
  const roomReservations = reservations.filter(
    res => res.roomId === roomId && res.id !== excludeReservationId
  );
  
  return !roomReservations.some(reservation => {
    const resStart = getLocalDateTime(reservation, 'start') || new Date(reservation.startTime);
    const resEnd = getLocalDateTime(reservation, 'end') || new Date(reservation.endTime);
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    
    // Prüfen auf Überschneidungen
    return (newStart < resEnd && newEnd > resStart);
  });
};

export const getReservationsForDate = (reservations, date) => {
  return reservations.filter(reservation => {
    try {
      // Primär: explizites date-Feld
      if (reservation?.date) {
        const [y, m, d] = String(reservation.date).split('-').map(Number);
        if (
          y === date.getFullYear() &&
          (m - 1) === date.getMonth() &&
          d === date.getDate()
        ) return true;
        // Falls das date-Feld aus früheren Off-by-one Fehlern stammt, fallback auf Startzeit
      }
      const resDate = getLocalDateTime(reservation, 'start') || new Date(reservation.startTime);
      return (
        resDate.getDate() === date.getDate() &&
        resDate.getMonth() === date.getMonth() &&
        resDate.getFullYear() === date.getFullYear()
      );
    } catch (_) {
      return false;
    }
  });
};

export const getReservationsForRoom = (reservations, roomId) => {
  return reservations.filter(reservation => parseInt(reservation.roomId) === parseInt(roomId))
    .sort((a, b) => {
      const aStart = getLocalDateTime(a, 'start') || new Date(a.startTime);
      const bStart = getLocalDateTime(b, 'start') || new Date(b.startTime);
      return aStart - bStart;
    });
};
