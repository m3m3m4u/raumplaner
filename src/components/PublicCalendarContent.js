'use client';

import { useMemo, useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar as CalendarIcon, Lock, MapPin, Users, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRooms } from '../contexts/RoomContext';
import { getLocalDateTime, getReservationsForRoom } from '../lib/roomData';

const PublicCalendarContent = () => {
  const { rooms, reservations, schedule } = useRooms();
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const todayLabel = useMemo(() => (
    new Date().toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  ), []);

  const roomsSorted = useMemo(() => (
    [...rooms].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de', { sensitivity: 'base' }))
  ), [rooms]);

  useEffect(() => {
    if (!roomsSorted.length) {
      setSelectedRoomId(null);
      return;
    }
    const exists = roomsSorted.some(room => String(room.id) === String(selectedRoomId));
    if (!exists) {
      setSelectedRoomId(roomsSorted[0].id);
    }
  }, [roomsSorted, selectedRoomId]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
  }, [referenceDate]);

  const effectiveSchedule = useMemo(() => {
    if (!schedule || schedule.length === 0) {
      return Array.from({ length: 9 }, (_, idx) => ({
        id: `fallback-${idx}`,
        name: `${idx + 1}. Stunde`,
        startTime: `${String(8 + idx).padStart(2, '0')}:00`,
        endTime: `${String(9 + idx).padStart(2, '0')}:00`,
        color: 'gray-200'
      }));
    }
    return [...schedule]
      .map(period => ({ ...period }))
      .sort((a, b) => {
        const [ah, am] = String(a.startTime || '00:00').split(':').map(Number);
        const [bh, bm] = String(b.startTime || '00:00').split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });
  }, [schedule]);

  const reservationsByRoom = useMemo(() => {
    const map = new Map();
    roomsSorted.forEach(room => {
      map.set(room.id, getReservationsForRoom(reservations, room.id));
    });
    return map;
  }, [roomsSorted, reservations]);

  const selectedRoom = roomsSorted.find(room => String(room.id) === String(selectedRoomId)) || null;

  const renderRoomStatus = (room) => {
    const roomReservations = reservationsByRoom.get(room.id) || [];
    if (roomReservations.length === 0) {
      return (
        <p className="text-sm text-green-600 font-medium">Aktuell frei</p>
      );
    }

    const now = new Date();
    const currentReservation = roomReservations.find(res => {
      const start = getLocalDateTime(res, 'start') || new Date(res.startTime);
      const end = getLocalDateTime(res, 'end') || new Date(res.endTime);
      return start <= now && end > now;
    });

    if (currentReservation) {
      const start = getLocalDateTime(currentReservation, 'start') || new Date(currentReservation.startTime);
      const end = getLocalDateTime(currentReservation, 'end') || new Date(currentReservation.endTime);
      return (
        <div className="text-sm text-red-600">
          <span className="font-medium">Jetzt belegt</span>
          <div className="flex items-center gap-1 mt-0.5 text-red-500">
            <Clock className="w-3.5 h-3.5" />
            <span>{format(start, 'HH:mm', { locale: de })} – {format(end, 'HH:mm', { locale: de })}</span>
          </div>
          {currentReservation.title && (
            <p className="text-xs text-red-400 mt-0.5">{currentReservation.title}</p>
          )}
        </div>
      );
    }

    const nextReservation = roomReservations.find(res => {
      const start = getLocalDateTime(res, 'start') || new Date(res.startTime);
      return start > now;
    });

    if (!nextReservation) {
      return (
        <p className="text-sm text-green-600 font-medium">Aktuell frei</p>
      );
    }

    const nextStart = getLocalDateTime(nextReservation, 'start') || new Date(nextReservation.startTime);
    const nextEnd = getLocalDateTime(nextReservation, 'end') || new Date(nextReservation.endTime);

    return (
      <div className="text-sm text-amber-600">
        <span className="font-medium">Frei bis {format(nextStart, 'HH:mm', { locale: de })}</span>
        <div className="flex items-center gap-1 mt-0.5 text-amber-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Nächste Buchung {format(nextStart, 'HH:mm', { locale: de })} – {format(nextEnd, 'HH:mm', { locale: de })}</span>
        </div>
        {nextReservation.title && (
          <p className="text-xs text-amber-400 mt-0.5">{nextReservation.title}</p>
        )}
      </div>
    );
  };

  const goToPreviousWeek = () => {
    setReferenceDate(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setReferenceDate(prev => addDays(prev, 7));
  };

  const goToCurrentWeek = () => {
    setReferenceDate(new Date());
  };

  const renderRoomGrid = () => {
    if (!selectedRoom) {
      return (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
          Bitte einen Raum aus der Übersicht auswählen.
        </div>
      );
    }

    const roomReservations = reservationsByRoom.get(selectedRoom.id) || [];
    const columnTemplate = `160px repeat(${weekDays.length}, minmax(0, 1fr))`;

    const resolveColorClass = (color) => {
      switch (color) {
        case 'gray-100': return 'bg-gray-100';
        case 'gray-200': return 'bg-gray-200';
        case 'gray-300': return 'bg-gray-300';
        case 'gray-400': return 'bg-gray-400';
        case 'gray-500': return 'bg-gray-500 text-gray-100';
        default: return 'bg-gray-100';
      }
    };

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-6 py-5 border-b border-gray-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{selectedRoom.name}</h2>
            <p className="text-sm text-gray-500">
              Wochenübersicht für alle Perioden und Wochentage.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              {selectedRoom.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedRoom.location}
                </span>
              )}
              {selectedRoom.capacity && (
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {selectedRoom.capacity} Personen
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={goToPreviousWeek}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 hover:bg-gray-100"
              aria-label="Vorherige Woche"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-[170px] text-center font-medium text-gray-700">
              {format(weekDays[0], 'dd.MM.yyyy', { locale: de })} – {format(weekDays[weekDays.length - 1], 'dd.MM.yyyy', { locale: de })}
            </div>
            <button
              type="button"
              onClick={goToNextWeek}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 hover:bg-gray-100"
              aria-label="Nächste Woche"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToCurrentWeek}
              className="ml-3 px-3 py-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
            >
              Aktuelle Woche
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div
              className="grid border-b border-gray-200"
              style={{ gridTemplateColumns: columnTemplate }}
            >
              <div className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-r border-gray-200">
                Periode
              </div>
              {weekDays.map(day => (
                <div
                  key={day.toISOString()}
                  className={`p-3 text-center text-sm font-medium border-r border-gray-200 last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-700'}`}
                >
                  <div>{format(day, 'EEEE', { locale: de })}</div>
                  <div className="text-xs text-gray-400">{format(day, 'dd.MM.', { locale: de })}</div>
                </div>
              ))}
            </div>

            {effectiveSchedule.map(period => {
              const [pStartHour, pStartMinute] = String(period.startTime || '00:00').split(':').map(Number);
              const [pEndHour, pEndMinute] = String(period.endTime || '00:00').split(':').map(Number);
              const colorClass = resolveColorClass(period.color);

              return (
                <div
                  key={period.id}
                  className="grid border-b border-gray-100"
                  style={{ gridTemplateColumns: columnTemplate }}
                >
                  <div className={`p-3 border-r border-gray-200 text-sm font-medium ${colorClass}`}>
                    <div>{period.name || `${period.startTime} – ${period.endTime}`}</div>
                    <div className="text-xs text-gray-500">
                      {period.startTime} – {period.endTime}
                    </div>
                  </div>
                  {weekDays.map(day => {
                    const slotStart = new Date(day);
                    slotStart.setHours(pStartHour, pStartMinute, 0, 0);
                    const slotEnd = new Date(day);
                    slotEnd.setHours(pEndHour, pEndMinute, 0, 0);

                    const overlapping = roomReservations.filter(reservation => {
                      const resStart = getLocalDateTime(reservation, 'start') || new Date(reservation.startTime);
                      const resEnd = getLocalDateTime(reservation, 'end') || new Date(reservation.endTime);
                      return resStart < slotEnd && resEnd > slotStart;
                    });

                    if (overlapping.length === 0) {
                      return (
                        <div
                          key={`${period.id}-${day.toISOString()}`}
                          className="min-h-[70px] border-r border-gray-200 last:border-r-0 p-3 text-sm text-gray-400 flex items-center justify-center"
                        >
                          Frei
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${period.id}-${day.toISOString()}`}
                        className="min-h-[70px] border-r border-gray-200 last:border-r-0 p-3 text-sm bg-blue-50/80 text-blue-900"
                      >
                        <ul className="space-y-1">
                          {overlapping.map(reservation => {
                            const resStart = getLocalDateTime(reservation, 'start') || new Date(reservation.startTime);
                            const resEnd = getLocalDateTime(reservation, 'end') || new Date(reservation.endTime);
                            return (
                              <li key={reservation.id} className="leading-snug">
                                <div className="font-semibold text-xs uppercase tracking-wide text-blue-700">
                                  {format(resStart, 'HH:mm', { locale: de })} – {format(resEnd, 'HH:mm', { locale: de })}
                                </div>
                                <div className="text-sm font-medium">{reservation.title || 'Reservierung'}</div>
                                {reservation.organizer && (
                                  <div className="text-xs text-blue-600">{reservation.organizer}</div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Raumplan</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Öffentliche Kalenderansicht aller Räume – rein zur Anzeige, Bearbeitungen sind deaktiviert.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">
                <Lock className="w-4 h-4" />
                <span>Nur-Lesen Modus</span>
              </div>
              <div className="text-gray-500">{todayLabel}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Räume im Überblick</h2>
          {roomsSorted.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Räume vorhanden.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {roomsSorted.map(room => {
                const isSelected = String(room.id) === String(selectedRoomId);
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`rounded-lg border px-4 py-4 text-left flex flex-col gap-3 transition-all ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{room.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {room.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {room.location}
                          </span>
                        )}
                        {room.capacity && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {room.capacity} Personen
                          </span>
                        )}
                      </div>
                    </div>
                    {renderRoomStatus(room)}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {renderRoomGrid()}

        <footer className="text-xs text-gray-400 text-center">
          Bereitgestellt als öffentlicher Link zur reinen Ansicht der aktuellen Raumbelegung.
        </footer>
      </main>
    </div>
  );
};

export default PublicCalendarContent;
