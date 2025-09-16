// API Service für Raumverwaltung
import { getLocalDateTime } from './roomData';

const API_BASE_URL = '/api';

// Generische API-Anfrage Funktion
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// Räume API
export const roomsAPI = {
  // Alle Räume abrufen
  getAll: async () => {
    const response = await apiRequest('/rooms');
    return response.data;
  },

  // Neuen Raum erstellen
  create: async (roomData) => {
    const response = await apiRequest('/rooms', {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
    return response.data;
  },

  // Raum nach ID abrufen
  getById: async (id) => {
    const rooms = await roomsAPI.getAll();
    return rooms.find(room => room.id === parseInt(id));
  },
};

// Reservierungen API
export const reservationsAPI = {
  // Alle Reservierungen abrufen
  getAll: async () => {
    const response = await apiRequest('/reservations');
    return response.data;
  },

  // Neue Reservierung erstellen
  create: async (reservationData) => {
    const response = await apiRequest('/reservations', {
      method: 'POST',
      body: JSON.stringify(reservationData),
    });
    return response.data;
  },

  // Reservierung aktualisieren
  update: async (id, reservationData) => {
    const response = await apiRequest(`/reservations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reservationData),
    });
    return response.data;
  },

  // Reservierung löschen
  delete: async (id) => {
    const response = await apiRequest(`/reservations/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  // Reservierungen für einen bestimmten Raum
  getByRoom: async (roomId) => {
    const reservations = await reservationsAPI.getAll();
    return reservations.filter(res => res.roomId === parseInt(roomId))
      .sort((a, b) => {
        const as = getLocalDateTime(a, 'start') || new Date(a.startTime);
        const bs = getLocalDateTime(b, 'start') || new Date(b.startTime);
        return as - bs;
      });
  },

  // Reservierungen für ein bestimmtes Datum
  getByDate: async (date) => {
    const reservations = await reservationsAPI.getAll();
    return reservations.filter(reservation => {
      const resDate = getLocalDateTime(reservation, 'start') || new Date(reservation.startTime);
      return (
        resDate.getDate() === date.getDate() &&
        resDate.getMonth() === date.getMonth() &&
        resDate.getFullYear() === date.getFullYear()
      );
    });
  },
};

// Hilfsfunktionen
export const utilsAPI = {
  // Prüfen ob ein Raum verfügbar ist
  isRoomAvailable: async (roomId, startTime, endTime, excludeReservationId = null) => {
    try {
      const reservations = await reservationsAPI.getAll();
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
    } catch (error) {
      console.error('Fehler bei Verfügbarkeitsprüfung:', error);
      return false;
    }
  },

  // Aktuell belegte Räume
  getCurrentlyOccupiedRooms: async () => {
    try {
      const reservations = await reservationsAPI.getAll();
      const now = new Date();
      
      return reservations.filter(res => {
        const start = getLocalDateTime(res, 'start') || new Date(res.startTime);
        const end = getLocalDateTime(res, 'end') || new Date(res.endTime);
        return start <= now && end > now;
      }).map(res => res.roomId);
    } catch (error) {
      console.error('Fehler beim Abrufen belegter Räume:', error);
      return [];
    }
  },
};
