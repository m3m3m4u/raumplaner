import { EventEmitter } from 'events';

// Globaler EventEmitter für Server-seitige Broadcasts (SSE)
export const events = global.__raumplan_events__ || new EventEmitter();
events.setMaxListeners(0);

if (!global.__raumplan_events__) {
  global.__raumplan_events__ = events;
}

export const emitReservationsChanged = (info = {}) => {
  try {
    events.emit('reservations-changed', { ts: Date.now(), ...info });
  } catch (_) {}
};

export const emitScheduleChanged = (info = {}) => {
  try {
    events.emit('schedule-changed', { ts: Date.now(), ...info });
  } catch (_) {}
};

export default events;