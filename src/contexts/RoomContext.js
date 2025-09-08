'use client';

import { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { initialRooms, initialReservations } from '../lib/roomData';

// Context für die Raumverwaltung
const RoomContext = createContext();

// Reducer für Zustandsverwaltung
const roomReducer = (state, action) => {
  switch (action.type) {
    case 'SET_ROOMS':
      return {
        ...state,
        rooms: [...action.payload].sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'de', { sensitivity: 'base' }))
      };

    case 'SET_RESERVATIONS':
      return {
        ...state,
        reservations: action.payload
      };
      
    case 'ADD_ROOM':
      return {
        ...state,
        rooms: [...state.rooms, { ...action.payload, id: action.payload.id || Date.now() }]
          .sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'de', { sensitivity: 'base' }))
      };
    
    case 'UPDATE_ROOM':
      return {
        ...state,
        rooms: state.rooms
          .map(room => room.id === action.payload.id ? action.payload : room)
          .sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'de', { sensitivity: 'base' }))
      };
    
    case 'DELETE_ROOM':
      return {
        ...state,
        rooms: state.rooms.filter(room => room.id !== action.payload),
        reservations: state.reservations.filter(res => res.roomId !== action.payload)
      };
    
    case 'ADD_RESERVATION':
      const newReservation = action.payload.id ? action.payload : { ...action.payload, id: Date.now() };
      console.log('Context: Füge Reservierung hinzu:', newReservation); // Debug
      return {
        ...state,
        reservations: [...state.reservations, newReservation]
      };
    
    case 'UPDATE_RESERVATION':
      console.log('Context: Aktualisiere Reservierung:', action.payload); // Debug
      console.log('Vorherige Reservierungen:', state.reservations); // Debug
      console.log('Suche nach ID:', action.payload.id, 'Typ:', typeof action.payload.id); // Debug
      
      // Stelle sicher, dass IDs verglichen werden können (beide als Number)
      const targetId = parseInt(action.payload.id);
      const updatedReservations = state.reservations.map(res => {
        const resId = parseInt(res.id);
        console.log(`Vergleiche ${resId} mit ${targetId}:`, resId === targetId); // Debug
        return resId === targetId ? { ...action.payload, id: targetId } : res;
      });
      
      console.log('Neue Reservierungen:', updatedReservations); // Debug
      return {
        ...state,
        reservations: updatedReservations
      };
    
    case 'DELETE_RESERVATION':
      return {
        ...state,
        reservations: state.reservations.filter(res => res.id !== action.payload)
      };

    case 'SET_SCHEDULE':
      return {
        ...state,
        schedule: action.payload
      };

    case 'UPDATE_SCHEDULE_PERIOD':
      return {
        ...state,
        schedule: state.schedule.map(period => 
          period.id === action.payload.id ? action.payload : period
        )
      };

    case 'ADD_SCHEDULE_PERIOD':
      const newPeriod = {
        ...action.payload,
        id: action.payload.id || Date.now() // Generiere ID falls nicht vorhanden
      };
      return {
        ...state,
        schedule: [...state.schedule, newPeriod]
          .sort((a, b) => {
            // Sortiere nach Zeit (startTime)
            const timeA = a.startTime.split(':').map(Number);
            const timeB = b.startTime.split(':').map(Number);
            return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
          })
      };

    case 'DELETE_SCHEDULE_PERIOD':
      return {
        ...state,
        schedule: state.schedule.filter(period => period.id !== action.payload)
      };

    default:
      return state;
  }
};

// Initial Schedule Data
const initialSchedule = [
  { id: 1, name: "1. Stunde", startTime: "8:00", endTime: "8:50" },
  { id: 2, name: "2. Stunde", startTime: "8:50", endTime: "9:40" },
  { id: 3, name: "3. Stunde", startTime: "9:40", endTime: "10:30" },
  { id: 4, name: "4. Stunde", startTime: "10:30", endTime: "11:20" },
  { id: 5, name: "5. Stunde", startTime: "11:20", endTime: "12:10" },
  { id: 6, name: "6. Stunde", startTime: "12:10", endTime: "13:00" },
  { id: 7, name: "7. Stunde", startTime: "13:00", endTime: "13:50" },
  { id: 8, name: "8. Stunde", startTime: "13:50", endTime: "14:40" }
];

// Provider-Komponente
export const RoomProvider = ({ children }) => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [state, dispatch] = useReducer(roomReducer, {
    rooms: [], // Starte mit leerem Array
    reservations: initialReservations,
    schedule: initialSchedule
  });

  // Hydration-Flag setzen
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Funktion zum Laden der Reservierungen - mit useCallback
  const loadReservations = useCallback(async () => {
    try {
      console.log('Context: Lade Reservierungen von API...'); // Debug
      const response = await fetch('/api/reservations');
      if (response.ok) {
        const result = await response.json();
        const apiReservations = result.data || result;
        console.log('Context: API-Reservierungen erhalten:', apiReservations); // Debug
        
        dispatch({
          type: 'SET_RESERVATIONS',
          payload: Array.isArray(apiReservations) ? apiReservations : []
        });
      } else {
        console.error('Context: API-Fehler bei Reservierungen'); // Debug
      }
    } catch (error) {
      console.error('Context: Fehler beim Laden der Reservierungen:', error); // Debug
    }
  }, [dispatch]);

  // Alle Daten von APIs laden
  useEffect(() => {
    const loadRooms = async () => {
      try {
        console.log('Context: Lade Räume von API...'); // Debug
        const response = await fetch('/api/rooms');
        if (response.ok) {
          const apiRooms = await response.json();
          console.log('Context: API-Räume erhalten:', apiRooms); // Debug
          
          dispatch({
            type: 'SET_ROOMS',
            payload: Array.isArray(apiRooms) ? apiRooms : []
          });
        } else {
          console.error('Context: API-Fehler bei Räumen'); // Debug
        }
      } catch (error) {
        console.error('Context: Fehler beim Laden der Räume:', error); // Debug
      }
    };

    const loadSchedule = async () => {
      try {
        console.log('Context: Lade Schedule von API...'); // Debug
        const response = await fetch('/api/schedule');
        if (response.ok) {
          const apiSchedule = await response.json();
          console.log('Context: API-Schedule erhalten:', apiSchedule); // Debug
          
          dispatch({
            type: 'SET_SCHEDULE',
            payload: Array.isArray(apiSchedule) ? apiSchedule : []
          });
        } else {
          console.error('Context: API-Fehler bei Schedule'); // Debug
        }
      } catch (error) {
        console.error('Context: Fehler beim Laden der Schedule:', error); // Debug
      }
    };

    loadRooms();
    loadReservations(); // Verwende die außerhalb definierte Funktion
    loadSchedule();
  }, [loadReservations]); // loadReservations als Dependency hinzufügen

  console.log('Context: Aktuelle Räume:', state.rooms); // Debug
  console.log('Context: Aktuelle Schedule:', state.schedule); // Debug

  const value = {
    rooms: state.rooms,
    reservations: state.reservations,
    schedule: state.schedule,
    dispatch,
    loadReservations // Funktion exportieren
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
};

// Hook für die Verwendung des Contexts
export const useRooms = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRooms muss innerhalb eines RoomProviders verwendet werden');
  }
  return context;
};
