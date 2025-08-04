'use client';

import { useState, useEffect } from 'react';
import { useRooms } from '../contexts/RoomContext';
import { MapPin, Users, Monitor, Calendar, Clock, Edit, Trash2, ArrowLeft, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { getReservationsForRoom, getReservationsForDate } from '../lib/roomData';
import { format, addDays, startOfWeek, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import ReservationForm from './ReservationForm';

const SimpleRoomDetailPage = ({ roomId }) => {
  const { rooms, reservations, dispatch, schedule } = useRooms();
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [editReservation, setEditReservation] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [detailPopupReservation, setDetailPopupReservation] = useState(null);
  
  const room = rooms.find(r => r.id === parseInt(roomId));

  // Funktion zur korrekten Anzeige der Endzeit 
  const getDisplayEndTime = (endTimeString) => {
    const endTime = new Date(endTimeString);
    return endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  // Listener für Nachrichten vom Reservierungsformular
  useEffect(() => {
    const handleMessage = async (event) => {
      console.log('Nachricht empfangen:', event.data); // Debug
      
      if (event.origin !== window.location.origin) {
        console.log('Falscher Origin:', event.origin); // Debug
        return;
      }
      
      if (event.data.type === 'ADD_RESERVATIONS') {
        console.log('Füge Reservierungen hinzu:', event.data.payload); // Debug
        
        // Speichere alle Reservierungen über die API
        for (const reservation of event.data.payload) {
          console.log(`Speichere Reservierung:`, reservation); // Debug
          
          const requestBody = {
            roomId: reservation.roomId,
            title: reservation.title,
            startTime: reservation.startTime,
            endTime: reservation.endTime,
            organizer: 'System', // Fallback
            attendees: 0, // Fallback
            description: reservation.description || ''
          };
          
          console.log('Request Body:', requestBody); // Debug
          
          try {
            const response = await fetch('/api/reservations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody)
            });

            if (response.ok) {
              const result = await response.json();
              console.log('Reservierung erfolgreich gespeichert:', result.data);
              
              // Auch im Context hinzufügen für sofortige UI-Aktualisierung
              dispatch({
                type: 'ADD_RESERVATION',
                payload: result.data
              });
            } else {
              let error;
              try {
                error = await response.json();
              } catch (parseError) {
                error = { 
                  error: `HTTP ${response.status} - ${response.statusText}`,
                  details: parseError.message 
                };
              }
              console.error('Fehler beim Speichern der Reservierung:', error);
              console.error('Response Status:', response.status);
              console.error('Response Headers:', Object.fromEntries(response.headers.entries()));
              alert(`Fehler beim Speichern: ${error.error || JSON.stringify(error)}`);
            }
          } catch (error) {
            console.error('Netzwerkfehler beim Speichern:', error);
            alert('Netzwerkfehler beim Speichern der Reservierung');
          }
        }
        
        console.log('Alle Reservierungen verarbeitet'); // Debug
      } else if (event.data.type === 'GET_RESERVATION_DATA') {
        // Sende Reservierungsdaten an das Bearbeitungsfenster
        const reservationId = parseInt(event.data.payload);
        const reservation = reservations.find(r => r.id === reservationId);
        
        console.log('Hauptfenster: Anfrage für Reservierung ID:', reservationId); // Debug
        console.log('Gefundene Reservierung:', reservation); // Debug
        console.log('Alle verfügbaren Reservierungen:', reservations); // Debug
        
        if (reservation) {
          console.log('Sende Reservierungsdaten:', reservation); // Debug
          event.source.postMessage({
            type: 'RESERVATION_DATA',
            payload: reservation
          }, window.location.origin);
        } else {
          console.log('Reservierung nicht gefunden!'); // Debug
          event.source.postMessage({
            type: 'RESERVATION_DATA',
            payload: null
          }, window.location.origin);
        }
      } else if (event.data.type === 'UPDATE_RESERVATION') {
        console.log('Update Reservierung:', event.data.payload); // Debug
        
        try {
          const response = await fetch('/api/reservations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: event.data.payload.id,
              roomId: event.data.payload.roomId,
              title: event.data.payload.title,
              startTime: event.data.payload.startTime,
              endTime: event.data.payload.endTime,
              organizer: 'System', // Fallback
              attendees: 0, // Fallback
              description: event.data.payload.description || ''
            })
          });

          if (response.ok) {
            const result = await response.json();
            console.log('Reservierung erfolgreich aktualisiert:', result.data);
            
            // Erst die alte Reservierung löschen, dann die neue hinzufügen im Context
            dispatch({
              type: 'DELETE_RESERVATION',
              payload: parseInt(event.data.payload.id)
            });
            
            // Dann die aktualisierte Reservierung hinzufügen
            setTimeout(() => {
              dispatch({
                type: 'ADD_RESERVATION',
                payload: result.data
              });
            }, 10);
          } else {
            let error;
            try {
              error = await response.json();
            } catch (parseError) {
              error = { 
                error: `HTTP ${response.status} - ${response.statusText}`,
                details: parseError.message 
              };
            }
            console.error('Fehler beim Aktualisieren der Reservierung:', error);
            console.error('Response Status:', response.status);
            console.error('Response Headers:', Object.fromEntries(response.headers.entries()));
            alert(`Fehler beim Aktualisieren: ${error.error || JSON.stringify(error)}`);
          }
        } catch (error) {
          console.error('Netzwerkfehler beim Aktualisieren:', error);
          alert('Netzwerkfehler beim Aktualisieren der Reservierung');
        }
      }
    };

    // Cleanup-Funktion für '+' Symbole bei Fokus-Verlust
    const handleFocusOut = () => {
      // Verstecke alle '+' Symbole
      document.querySelectorAll('.plus-icon').forEach(icon => {
        icon.style.opacity = '0';
      });
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('blur', handleFocusOut);
    document.addEventListener('mouseleave', handleFocusOut);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('blur', handleFocusOut);
      document.removeEventListener('mouseleave', handleFocusOut);
    };
  }, [dispatch, reservations]);
  
  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Raum nicht gefunden</h1>
          <a href="/" className="text-blue-600 hover:text-blue-800">
            ← Zurück zur Raumübersicht
          </a>
        </div>
      </div>
    );
  }

  const roomReservations = getReservationsForRoom(reservations, room.id);

  const handleDeleteReservation = (reservationId) => {
    if (confirm('Sind Sie sicher, dass Sie diese Reservierung löschen möchten?')) {
      dispatch({
        type: 'DELETE_RESERVATION',
        payload: reservationId
      });
    }
  };

  const handleEditReservation = (reservation) => {
    setEditReservation(reservation);
    setShowReservationForm(true);
  };

  // Wochenfunktionen
  const getWeekDays = () => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Montag
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  // Schulstunden-System - nutzt Schedule aus Context
  const getSchoolPeriods = () => {
    console.log('SimpleRoomDetailPage - Schedule from Context:', schedule); // Debug
    
    return schedule.map(slot => ({
      id: slot.id,
      name: slot.name,
      time: `${slot.startTime} - ${slot.endTime}`,
      startTime: slot.startTime,
      endTime: slot.endTime
    }));
  };

  // Prüft ob eine Schulstunde (oder Hälfte) reserviert ist
  const getPeriodReservationInfo = (day, periodId, half = null) => {
    const periods = getSchoolPeriods();
    const periodInfo = periods.find(p => p.id === periodId);
    
    if (!periodInfo) return { isReserved: false, reservation: null, half: null };

    // Zeitgrenzen für die Periode berechnen
    const [startHour, startMinute] = periodInfo.startTime.split(':').map(Number);
    const [endHour, endMinute] = periodInfo.endTime.split(':').map(Number);
    
    let periodStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, startMinute, 0);
    let periodEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour, endMinute, 0);
    
    // Wenn nur eine Hälfte geprüft wird, passe die Zeiten an
    if (half === 'first') {
      const middleTime = new Date(periodStart.getTime() + (periodEnd.getTime() - periodStart.getTime()) / 2);
      periodEnd = middleTime;
    } else if (half === 'second') {
      const middleTime = new Date(periodStart.getTime() + (periodEnd.getTime() - periodStart.getTime()) / 2);
      periodStart = middleTime;
    }

    // Finde überlappende Reservierungen
    const overlappingReservation = roomReservations.find(reservation => {
      const resStart = new Date(reservation.startTime);
      const resEnd = new Date(reservation.endTime);
      
      return resStart < periodEnd && resEnd > periodStart;
    });

    if (!overlappingReservation) {
      return { isReserved: false, reservation: null, half: null };
    }

    // Bestimme welche Hälfte(n) reserviert sind
    const resStart = new Date(overlappingReservation.startTime);
    const resEnd = new Date(overlappingReservation.endTime);
    
    const fullPeriodStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, startMinute, 0);
    const fullPeriodEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour, endMinute, 0);
    const middleTime = new Date(fullPeriodStart.getTime() + (fullPeriodEnd.getTime() - fullPeriodStart.getTime()) / 2);
    
    const firstHalfReserved = resStart < middleTime && resEnd > fullPeriodStart;
    const secondHalfReserved = resStart < fullPeriodEnd && resEnd > middleTime;
    
    let reservedHalf = null;
    if (firstHalfReserved && secondHalfReserved) {
      reservedHalf = 'both';
    } else if (firstHalfReserved) {
      reservedHalf = 'first';
    } else if (secondHalfReserved) {
      reservedHalf = 'second';
    }

    return {
      isReserved: true,
      reservation: overlappingReservation,
      half: reservedHalf
    };
  };

  // KORRIGIERTE FUNKTION: Berechnet wo der blaue Balken startet und bis zum Ende der Zelle geht
  const getHourReservationInfo = (day, hour) => {
    const hourStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
    const hourEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour + 1, 0, 0);
    
    // Debug für Tag 5. August
    if (day.getDate() === 5) {
      console.log(`TAG 5. AUGUST, STUNDE ${hour}:`, {
        dayDate: day.toLocaleDateString('de-DE'),
        hourStart: hourStart.toLocaleString('de-DE'),
        hourEnd: hourEnd.toLocaleString('de-DE'),
        allReservations: roomReservations.map(r => ({
          title: r.title,
          start: r.startTime,
          end: r.endTime,
          startParsed: new Date(r.startTime).toLocaleString('de-DE'),
          endParsed: new Date(r.endTime).toLocaleString('de-DE')
        }))
      });
    }
    
    // Alle Reservierungen für diesen Raum
    const overlappingReservation = roomReservations.find(reservation => {
      const resStart = new Date(reservation.startTime);
      const resEnd = new Date(reservation.endTime);
      
      // Überlappungsprüfung
      const overlaps = resStart < hourEnd && resEnd > hourStart;
      
      // Debug für alle Stunden am 5. August
      if (day.getDate() === 5) {
        console.log(`STUNDE ${hour} CHECK:`, {
          reservationTitle: reservation.title,
          reservationStart: resStart.toLocaleString('de-DE'),
          reservationEnd: resEnd.toLocaleString('de-DE'),
          hourStart: hourStart.toLocaleString('de-DE'),
          hourEnd: hourEnd.toLocaleString('de-DE'),
          overlaps: overlaps,
          resStartHour: resStart.getHours(),
          targetHour: hour
        });
      }
      
      return overlaps;
    });

    if (!overlappingReservation) {
      return {
        isReserved: false,
        reservation: null,
        percentage: 0,
        startPosition: 0
      };
    }

    const resStart = new Date(overlappingReservation.startTime);
    const resEnd = new Date(overlappingReservation.endTime);
    
    // Wenn Reservierung in dieser Stunde beginnt, berechne Startposition
    let startPosition = 0;
    let percentage = 100;
    
    if (resStart >= hourStart && resStart < hourEnd) {
      // Reservierung beginnt in dieser Stunde
      const hourDurationMs = 60 * 60 * 1000;
      const startOffsetMs = resStart - hourStart;
      startPosition = Math.round((startOffsetMs / hourDurationMs) * 100);
      percentage = 100 - startPosition; // Vom Startpunkt bis Ende der Zelle
    } else if (resEnd > hourStart && resEnd <= hourEnd) {
      // Reservierung endet in dieser Stunde
      const hourDurationMs = 60 * 60 * 1000;
      const endOffsetMs = resEnd - hourStart;
      startPosition = 0; // Vom Anfang der Zelle
      percentage = Math.round((endOffsetMs / hourDurationMs) * 100);
    }
    // Sonst: Reservierung geht durch die ganze Stunde (startPosition = 0, percentage = 100)

    if (day.getDate() === 5) {
      console.log(`STUNDE ${hour} ENDERGEBNIS:`, {
        reservationStart: resStart.toLocaleString('de-DE'),
        reservationEnd: resEnd.toLocaleString('de-DE'),
        startPosition,
        percentage,
        reservationTitle: overlappingReservation.title,
        logic: resStart >= hourStart && resStart < hourEnd ? 'Beginnt hier' : 
               resEnd > hourStart && resEnd <= hourEnd ? 'Endet hier' : 'Geht durch'
      });
    }

    return {
      isReserved: true,
      reservation: overlappingReservation,
      percentage: Math.max(0, Math.min(100, percentage)),
      startPosition: Math.max(0, Math.min(100, startPosition))
    };
  };

  // Berechnen wie viele Slots eine Reservierung überspannt (nicht mehr benötigt)
  // const getReservationSlotSpan = (reservation, startHour, startMinute) => {
  //   const resStart = new Date(reservation.startTime);
  //   const resEnd = new Date(reservation.endTime);
  //   
  //   const slotStart = new Date(resStart);
  //   slotStart.setHours(startHour, startMinute, 0, 0);
  //   
  //   const durationMinutes = Math.floor((resEnd - resStart) / (1000 * 60));
  //   return Math.ceil(durationMinutes / 15);
  // };

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7));
  };

  const goToThisWeek = () => {
    setCurrentWeek(new Date());
  };

  const formatWeekHeader = () => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    return `${format(weekStart, 'dd.MM.', { locale: de })} - ${format(weekEnd, 'dd.MM.yyyy', { locale: de })}`;
  };

  const weekDays = getWeekDays();
  const schoolPeriods = getSchoolPeriods();

  // Prüfen ob Room existiert
  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Raum wird geladen...</h1>
          <p className="text-gray-600">Oder der Raum wurde nicht gefunden.</p>
          <a href="/" className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Zurück zur Übersicht
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <a href="/" className="mr-4 p-2 hover:bg-gray-100 rounded-md">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </a>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{room.name}</h1>
                <div className="flex items-center text-gray-600 mt-1">
                  {room.location && (
                    <>
                      <MapPin className="w-4 h-4 mr-1" />
                      <span className="mr-4">{room.location}</span>
                    </>
                  )}
                  {room.capacity && (
                    <>
                      <Users className="w-4 h-4 mr-1" />
                      <span>{room.capacity} Personen</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  // Öffne neues Browser-Fenster für Reservierung
                  const newWindow = window.open(
                    `/reservation-form?roomId=${roomId}`, 
                    'reservationForm',
                    'width=800,height=600,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no'
                  );
                  
                  if (newWindow) {
                    newWindow.focus();
                  }
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center font-medium"
              >
                <Plus className="w-5 h-5 mr-2" />
                Reservieren
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="py-8">
        {/* Raum-Info */}
        <div className="mx-4 sm:mx-6 lg:mx-8 bg-white rounded-lg shadow-md p-6 mb-6">
          <p className="text-gray-600 mb-4">{room.description || 'Keine Beschreibung verfügbar'}</p>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Ausstattung:</span>
            {room.equipment && room.equipment.length > 0 ? (
              room.equipment.map(equipment => (
                <span key={equipment} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs">
                  {equipment}
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-xs">Keine Ausstattung angegeben</span>
            )}
          </div>
        </div>

        {/* Wochenkalender - Vollbreite */}
        <div className="bg-white shadow-md">
          <div className="px-4 sm:px-6 lg:px-8 py-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center">
                <Calendar className="w-6 h-6 mr-2" />
                Reservierungen
              </h2>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={goToPreviousWeek}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="text-center">
                  <div className="font-medium">{formatWeekHeader()}</div>
                  <button
                    onClick={goToThisWeek}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Diese Woche
                  </button>
                </div>
                
                <button
                  onClick={goToNextWeek}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Wochentabelle - Echte Vollbreite */}
          <table className="w-full" style={{ 
            tableLayout: 'fixed', 
            width: '100vw',
            border: '3px solid #374151',
            borderCollapse: 'collapse'
          }}>
            {/* Header mit Wochentagen */}
            <thead>
              <tr>
                <th className="p-3 text-sm font-medium text-gray-500 bg-gray-50" 
                    style={{ 
                      width: '80px',
                      borderBottom: '3px solid #374151',
                      borderRight: '3px solid #6B7280'
                    }}>
                  Zeit
                </th>
                {weekDays.map(day => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th key={day.toISOString()} 
                        className={`p-3 text-center ${
                          isToday ? 'bg-blue-50' : 'bg-gray-50'
                        }`}
                        style={{ 
                          width: 'calc((100vw - 80px) / 7)',
                          borderBottom: '3px solid #374151',
                          borderRight: '3px solid #6B7280'
                        }}>
                      <div className={`text-sm font-medium ${
                        isToday ? 'text-blue-600' : 'text-gray-700'
                      }`}>
                        {format(day, 'EEE', { locale: de })}
                      </div>
                      <div className={`text-lg font-bold ${
                        isToday ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {format(day, 'd.M.', { locale: de })}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

              {/* Schulstunden */}
              <tbody>
                {schoolPeriods.map((period, periodIndex) => (
                  <tr key={period.id} 
                      style={{
                        borderTop: '3px solid #374151'
                      }}>
                    {/* Stunden-Spalte */}
                    <td className="p-2 text-sm text-gray-500 bg-gray-50 text-center font-medium" style={{ 
                      width: '80px',
                      borderRight: '2px solid #9CA3AF'
                    }}>
                      <div className="font-bold text-xs text-gray-700">{period.name}</div>
                      <div className="text-xs">{period.time}</div>
                    </td>

                    {/* Tag-Spalten */}
                    {weekDays.map(day => {
                      const periodInfo = getPeriodReservationInfo(day, period.id);
                      const reservation = periodInfo.reservation;
                      const isReserved = periodInfo.isReserved;
                      const reservedHalf = periodInfo.half;
                      const isToday = isSameDay(day, new Date());
                      
                      // Prüfen ob dies die erste Periode einer Reservierung ist
                      const isFirstPeriodOfReservation = reservation && 
                        isSameDay(new Date(reservation.startTime), day);

                      return (
                        <td key={`${day.toISOString()}-${period.id}`} 
                            className="relative"
                            style={{ 
                              height: '60px', // Etwas höher für Schulstunden
                              width: 'calc((100vw - 80px) / 7)',
                              borderRight: '2px solid #D1D5DB',
                              backgroundColor: isToday && !reservation ? '#EBF8FF' : '#FFFFFF',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              if (reservation) {
                                const blueBar = e.target.querySelector('.reservation-bar');
                                if (blueBar) {
                                  blueBar.style.opacity = '1.0';
                                }
                              } else {
                                // Leere Zelle: Zeige Hover-Effekt für neue Reservierung
                                e.currentTarget.style.backgroundColor = isToday ? '#DBEAFE' : '#F3F4F6';
                                
                                // Zeige '+' Symbol beim Hover
                                const plusIcon = e.currentTarget.querySelector('.plus-icon');
                                if (plusIcon) {
                                  plusIcon.style.opacity = '0.7';
                                }
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (reservation) {
                                const blueBar = e.target.querySelector('.reservation-bar');
                                if (blueBar) {
                                  blueBar.style.opacity = '0.8';
                                }
                              } else {
                                // Leere Zelle: Entferne Hover-Effekt
                                e.currentTarget.style.backgroundColor = isToday ? '#EBF8FF' : '#FFFFFF';
                                
                                // Verstecke '+' Symbol
                                const plusIcon = e.currentTarget.querySelector('.plus-icon');
                                if (plusIcon) {
                                  plusIcon.style.opacity = '0';
                                }
                              }
                            }}
                            onClick={() => {
                              if (reservation) {
                                setDetailPopupReservation(reservation);
                              } else {
                                // Leere Zelle: Öffne Reservierungsformular mit vorausgefüllten Daten
                                const formattedDate = format(day, 'yyyy-MM-dd');
                                const periodData = schoolPeriods[periodIndex];
                                const startHour = parseInt(periodData.startTime.split(':')[0]); // Extrahiere Stunde aus startTime
                                
                                const newWindow = window.open(
                                  `/reservation-form?roomId=${roomId}&date=${formattedDate}&startHour=${startHour}&endHour=${startHour}`, 
                                  'newReservationForm',
                                  'width=800,height=600,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no'
                                );
                                
                                if (newWindow) {
                                  newWindow.focus();
                                }
                              }
                            }}>

                          {/* Schulstunden-Balken für reservierte Zeitabschnitte */}
                          {isReserved && (
                            <div 
                              className="reservation-bar absolute"
                              style={{
                                left: '0px',
                                right: '-2px',
                                width: 'calc(100% + 2px)',
                                height: reservedHalf === 'first' ? '50%' : 
                                        reservedHalf === 'second' ? '50%' : '100%',
                                backgroundColor: '#3B82F6', // Einheitliches Blau für alle Termine
                                top: reservedHalf === 'second' ? '50%' : '0%',
                                opacity: 0.8,
                                border: 'none',
                                margin: '0',
                                padding: '0',
                                zIndex: 1
                              }}>
                              {/* Titel nur anzeigen wenn ganze Stunde oder erste Periode */}
                              {(reservedHalf === 'both' || reservedHalf === 'first') && isFirstPeriodOfReservation && (
                                <div className="text-white text-xs p-1 font-medium overflow-hidden drop-shadow-sm">
                                  {reservation.title}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* '+' Symbol für leere Zellen */}
                          {!isReserved && (
                            <div 
                              className="plus-icon absolute inset-0 flex items-center justify-center pointer-events-none"
                              style={{
                                opacity: 0,
                                transition: 'opacity 0.2s ease-in-out',
                                fontSize: '20px',
                                color: '#6B7280',
                                fontWeight: 'bold',
                                zIndex: 10
                              }}>
                              +
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </main>

      {/* Detail-Popup für Reservierungen - ZENTRIERT IN DER MITTE */}
      {detailPopupReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl transform transition-all">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-bold text-gray-900">📋 Termindetails</h3>
              <button
                onClick={() => setDetailPopupReservation(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <h4 className="text-xl font-bold text-blue-900 mb-4">{detailPopupReservation.title}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-600">⏰ Von:</span>
                    <span className="text-gray-900 text-lg">
                      {new Date(detailPopupReservation.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-600">⏰ Bis:</span>
                    <span className="text-gray-900 text-lg">
                      {getDisplayEndTime(detailPopupReservation.endTime)}
                    </span>
                  </div>
                  {detailPopupReservation.description && (
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-600">📝 Beschreibung:</span>
                      <span className="text-gray-700 text-lg">{detailPopupReservation.description}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8 space-x-4">
              <button
                onClick={() => setDetailPopupReservation(null)}
                className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-xl hover:bg-gray-300 transition-all text-lg font-medium"
              >
                🚪 Schließen
              </button>
              <button
                onClick={() => {
                  // Öffne Bearbeitungsfenster
                  const newWindow = window.open(
                    `/reservation-form?roomId=${roomId}&editId=${detailPopupReservation.id}`, 
                    'editReservationForm',
                    'width=800,height=600,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no'
                  );
                  
                  if (newWindow) {
                    newWindow.focus();
                    
                    // Warte kurz, bis das Fenster geladen ist, dann sende die Daten
                    setTimeout(() => {
                      console.log('Sende Reservierungsdaten an neues Fenster:', detailPopupReservation); // Debug
                      newWindow.postMessage({
                        type: 'RESERVATION_DATA',
                        payload: detailPopupReservation
                      }, window.location.origin);
                    }, 500);
                  }
                  
                  setDetailPopupReservation(null);
                }}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-all text-lg font-medium"
              >
                ✏️ Bearbeiten
              </button>
              <button
                onClick={() => {
                  setSelectedReservation(detailPopupReservation);
                  setDetailPopupReservation(null);
                }}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 transition-all text-lg font-medium"
              >
                🗑️ Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Details Modal */}
      {selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Reservierung Details</h3>
              <button
                onClick={() => setSelectedReservation(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <span className="font-medium text-gray-700">Titel:</span>
                <p className="text-gray-900">{selectedReservation.title}</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Zeit:</span>
                <p className="text-gray-900">
                  {format(new Date(selectedReservation.startTime), 'dd.MM.yyyy HH:mm', { locale: de })} - 
                  {getDisplayEndTime(selectedReservation.endTime)}
                </p>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Organisator:</span>
                <p className="text-gray-900">{selectedReservation.organizer}</p>
              </div>
              
              {selectedReservation.description && (
                <div>
                  <span className="font-medium text-gray-700">Beschreibung:</span>
                  <p className="text-gray-900">{selectedReservation.description}</p>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  handleEditReservation(selectedReservation);
                  setSelectedReservation(null);
                }}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Bearbeiten
              </button>
              <button
                onClick={() => {
                  handleDeleteReservation(selectedReservation.id);
                  setSelectedReservation(null);
                }}
                className="flex-1 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleRoomDetailPage;
