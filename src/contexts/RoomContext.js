'use client';

import { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';

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
        reservations: state.reservations.filter(res => parseInt(res.id) !== parseInt(action.payload))
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
const initialSchedule = [];

// Provider-Komponente
export const RoomProvider = ({ children }) => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [state, dispatch] = useReducer(roomReducer, {
  rooms: [],
  reservations: [],
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
  }, []);

  // Alle Daten von APIs laden
  useEffect(() => {
    // Live-Updates per SSE: Reservierungen automatisch neu laden
    let evtSrc;
    let evtSchedule;
    try {
      evtSrc = new EventSource('/api/reservations/events');
      evtSrc.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data || '{}');
          if (data?.type === 'reservations-changed') {
            loadReservations();
          }
        } catch (_) {}
      };
      // Beim ersten Connect einmal initial laden (falls noch nicht)
      evtSrc.onopen = () => { try { /* optional */ } catch(_){} };
      evtSrc.onerror = () => { /* still retry by browser */ };

      // Schedule-Events: bei Änderungen Schedule neu laden
      evtSchedule = new EventSource('/api/schedule/events');
      const reloadSchedule = async () => {
        try {
          const response = await fetch('/api/schedule');
          if (response.ok) {
            const apiSchedule = await response.json();
            dispatch({ type: 'SET_SCHEDULE', payload: Array.isArray(apiSchedule) ? apiSchedule : [] });
          }
        } catch (_) {}
      };
      evtSchedule.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data || '{}');
          if (data?.type === 'schedule-changed') {
            reloadSchedule();
          }
        } catch (_) {}
      };
      evtSchedule.onopen = () => { try { /* optional */ } catch(_){} };
      evtSchedule.onerror = () => { /* keep-alive retry */ };
    } catch (e) {
      // SSE nicht verfügbar – ignorieren
    }
    
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

    return () => {
      try { if (evtSrc) evtSrc.close(); } catch(_){}
      try { if (evtSchedule) evtSchedule.close(); } catch(_){}
    };
  }, [loadReservations]);

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
