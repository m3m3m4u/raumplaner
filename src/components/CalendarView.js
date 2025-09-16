'use client';

import { useState, useEffect } from 'react';
import { useRooms } from '../contexts/RoomContext';
import { getReservationsForDate, getLocalDateTime } from '../lib/roomData';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, MapPin } from 'lucide-react';

const CalendarView = () => {
  const { rooms, reservations, schedule } = useRooms();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // 'day', 'week'
  const [showWeekend, setShowWeekend] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydration-Flag setzen
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const goToPrevious = () => {
    if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, -1));
    } else {
      setCurrentDate(prev => addDays(prev, -7));
    }
  };

  const goToNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, 1));
    } else {
      setCurrentDate(prev => addDays(prev, 7));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Woche beginnt am Montag
    const all = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return showWeekend ? all : all.filter(d => {
      const dow = d.getDay(); // 0=So,6=Sa
      return dow >= 1 && dow <= 5;
    });
  };

  const getTimeSlots = () => {
    // Debug: Protokolliere Schedule-Daten
    console.log('CalendarView - Schedule-Daten:', schedule);
    console.log('CalendarView - Schedule Länge:', schedule ? schedule.length : 'undefined');
    
    // Verwende IMMER die Schedule-Daten aus dem Context, niemals Fallback
    if (!isHydrated || !schedule || schedule.length === 0) {
      console.log('CalendarView - WARNUNG: Keine Schedule-Daten verfügbar oder nicht hydrated!');
      return []; // Leeres Array vor Hydration oder ohne Daten
    }
    
    // Erstelle Zeitslots basierend auf den Schedule-Daten
    const slots = schedule
      .sort((a, b) => {
        // Sortiere nach Zeit (startTime)
        const timeA = a.startTime.split(':').map(Number);
        const timeB = b.startTime.split(':').map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
      })
      .map(period => period.startTime);
    
    console.log('CalendarView - Generierte Zeitslots:', slots);
    console.log('CalendarView - Anzahl Zeitslots:', slots.length);
    return slots;
  };

  const getReservationForTimeSlot = (date, time, roomId) => {
    // Finde die entsprechende Schedule-Periode für diese Zeit
    const period = schedule.find(p => p.startTime === time);
    if (!period) {
      // Keine Periode gefunden - kein Fallback, return null
      console.log('CalendarView - Keine Periode für Zeit gefunden:', time);
      return null;
    }

    // Verwende die exakten Zeiten aus der Schedule
    const [startHour, startMin] = period.startTime.split(':').map(Number);
    const [endHour, endMin] = period.endTime.split(':').map(Number);
    
    const slotStart = new Date(date);
    slotStart.setHours(startHour, startMin, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(endHour, endMin, 0, 0);

    return reservations.find(res => {
      const resStart = getLocalDateTime(res, 'start') || new Date(res.startTime);
      const resEnd = getLocalDateTime(res, 'end') || new Date(res.endTime);
      
      return res.roomId === roomId &&
             resStart < slotEnd &&
             resEnd > slotStart;
    });
  };

  const formatDateHeader = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'EEEE, dd. MMMM yyyy', { locale: de });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, 'dd.MM.', { locale: de })} - ${format(weekEnd, 'dd.MM.yyyy', { locale: de })}`;
    }
  };

  const ReservationCard = ({ reservation, compact = false }) => {
    const room = rooms.find(r => r.id === reservation.roomId);
    
    return (
      <div className={`bg-blue-100 border-l-4 border-blue-500 p-2 rounded text-xs ${compact ? 'mb-1' : 'mb-2'}`}>
        <div className="font-medium text-blue-800 truncate">
          {reservation.title}
        </div>
        {!compact && (
          <>
            <div className="text-blue-600 flex items-center mt-1">
              <Clock className="w-3 h-3 mr-1" />
              {format(getLocalDateTime(reservation, 'start') || new Date(reservation.startTime), 'HH:mm', { locale: de })} - 
              {format(getLocalDateTime(reservation, 'end') || new Date(reservation.endTime), 'HH:mm', { locale: de })}
            </div>
            <div className="text-blue-600 flex items-center">
              <Users className="w-3 h-3 mr-1" />
              {reservation.organizer}
              {reservation.attendees && ` (${reservation.attendees})`}
            </div>
            {room && (
              <div className="text-blue-600 flex items-center">
                <MapPin className="w-3 h-3 mr-1" />
                {room.name}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (viewMode === 'day') {
    const dayReservations = getReservationsForDate(reservations, currentDate);
    
    return (
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <Calendar className="w-6 h-6 mr-2" />
              Tagesansicht
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setViewMode('week')}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Woche
              </button>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={goToPrevious}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <h3 className="text-lg font-medium">{formatDateHeader()}</h3>
              <button
                onClick={goToToday}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Heute
              </button>
            </div>
            
            <button
              onClick={goToNext}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {dayReservations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Keine Reservierungen für diesen Tag
            </p>
          ) : (
            <div className="space-y-3">
              {dayReservations
                .sort((a, b) => {
                  const aStart = getLocalDateTime(a, 'start') || new Date(a.startTime);
                  const bStart = getLocalDateTime(b, 'start') || new Date(b.startTime);
                  return aStart - bStart;
                })
                .map(reservation => (
                  <ReservationCard key={reservation.id} reservation={reservation} />
                ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Wochenansicht
  const weekDays = getWeekDays();
  const dayCount = weekDays.length;
  const gridTemplate = `80px repeat(${dayCount}, minmax(0, 1fr))`;
  const timeSlots = getTimeSlots();

  return (
    <div className="bg-white rounded-lg shadow-md mx-2 sm:mx-3 lg:mx-4 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <Calendar className="w-6 h-6 mr-2" />
            Wochenansicht
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('day')}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Tag
            </button>
            <label className="ml-3 inline-flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                className="mr-2"
                checked={showWeekend}
                onChange={e => setShowWeekend(e.target.checked)}
              />
              Wochenende anzeigen
            </label>
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={goToPrevious}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <h3 className="text-lg font-medium">{formatDateHeader()}</h3>
            <button
              onClick={goToToday}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Heute
            </button>
          </div>
          
          <button
            onClick={goToNext}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Header mit Wochentagen */}
          <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="p-3 text-sm font-medium text-gray-500 border-r border-gray-200">
              Zeit
            </div>
            {weekDays.map(day => (
              <div key={day.toISOString()} className="p-3 text-center border-r border-gray-200 last:border-r-0">
                <div className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-gray-700'}`}>
                  {format(day, 'EEE', { locale: de })}
                </div>
                <div className={`text-lg ${isSameDay(day, new Date()) ? 'text-blue-600 font-bold' : 'text-gray-900'}`}>
                  {format(day, 'd', { locale: de })}
                </div>
              </div>
            ))}
          </div>

          {/* Zeitslots */}
          {timeSlots.map(time => (
            <div key={time} className="grid border-b border-gray-100" style={{ gridTemplateColumns: gridTemplate }}>
              {(() => {
                const period = schedule.find(p => p.startTime === time);
                const colorClass = period?.color === 'gray-100' ? 'bg-gray-100' : period?.color === 'gray-200' ? 'bg-gray-200' : period?.color === 'gray-300' ? 'bg-gray-300' : period?.color === 'gray-400' ? 'bg-gray-400' : period?.color === 'gray-500' ? 'bg-gray-500' : 'bg-gray-50';
                const textClass = period?.color && ['gray-400','gray-500'].includes(period.color) ? 'text-gray-100' : 'text-gray-700';
                return (
                  <div className={`p-3 text-sm ${textClass} border-r border-gray-200 ${colorClass}`}>
                    {time}
                  </div>
                );
              })()}
              {weekDays.map(day => {
                const period = schedule.find(p => p.startTime === time);
                const colorClass = period?.color === 'gray-100' ? 'bg-gray-100' : period?.color === 'gray-200' ? 'bg-gray-200' : period?.color === 'gray-300' ? 'bg-gray-300' : period?.color === 'gray-400' ? 'bg-gray-400' : period?.color === 'gray-500' ? 'bg-gray-500' : 'bg-white';
                const dayReservations = getReservationsForDate(reservations, day);
                const timeReservations = dayReservations.filter(reservation => {
                  // Nutze die exakten Periodenzeiten (inkl. Minuten)
                  let slotStart = new Date(day);
                  let slotEnd = new Date(day);
                  if (period) {
                    const [sH, sM] = period.startTime.split(':').map(Number);
                    const [eH, eM] = period.endTime.split(':').map(Number);
                    slotStart.setHours(sH, sM, 0, 0);
                    slotEnd.setHours(eH, eM, 0, 0);
                  } else {
                    // Fallback: falls Periodendaten fehlen, verwende time und +60min
                    const [sH, sM] = time.split(':').map(Number);
                    slotStart.setHours(sH, sM, 0, 0);
                    slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
                  }

                  const resStart = getLocalDateTime(reservation, 'start') || new Date(reservation.startTime);
                  const resEnd = getLocalDateTime(reservation, 'end') || new Date(reservation.endTime);
                  return resStart < slotEnd && resEnd > slotStart;
                });

                return (
                  <div
                    key={`${day.toISOString()}-${time}`}
                    className={`p-2 border-r border-gray-200 last:border-r-0 min-h-[60px] ${colorClass} ${timeReservations.length === 0 ? 'cursor-pointer hover:opacity-80 transition-colors' : ''}`}
                    onClick={() => {
                      if (timeReservations.length > 0) return; // Nur freie Zellen zum Anlegen
                      const formattedDate = format(day, 'yyyy-MM-dd');
                      const pid = period?.id;
                      const url = pid
                        ? `/reservation-form?date=${formattedDate}&startPeriodId=${pid}&endPeriodId=${pid}`
                        : `/reservation-form?date=${formattedDate}`;
                      const w = window.open(url, 'reservationForm', 'width=1040,height=760,scrollbars=yes,resizable=yes');
                      if (w) w.focus();
                    }}
                  >
                    {timeReservations.map(reservation => (
                      <ReservationCard key={reservation.id} reservation={reservation} compact />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
