'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRooms } from '../contexts/RoomContext';
import { MapPin, Users, Monitor, Calendar, Clock, Edit, Trash2, ArrowLeft, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { getReservationsForRoom, getReservationsForDate } from '../lib/roomData';
import { format, addDays, startOfWeek, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import ReservationForm from './ReservationForm';
import PasswordModal from './PasswordModal';

const SimpleRoomDetailPage = ({ roomId }) => {
  const { rooms, reservations, dispatch, schedule, loadReservations } = useRooms();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [passwordModal, setPasswordModal] = useState({ open: false, mode: null, reservationId: null, action: null });
  const [analysisConflicts, setAnalysisConflicts] = useState([]);
  const [analysisMode, setAnalysisMode] = useState(null);
  
  const openPasswordModal = (mode, reservationId, action) => setPasswordModal({ open: true, mode, reservationId, action });
  const closePasswordModal = () => setPasswordModal(prev => ({ ...prev, open: false }));
  
  const handlePasswordSubmit = async (pwd) => {
    if (!passwordModal.reservationId || !passwordModal.mode) { closePasswordModal(); return; }
    const reservation = reservations.find(r => r.id === passwordModal.reservationId);
    if (!reservation) { closePasswordModal(); return; }
    if (passwordModal.mode === 'edit') {
      // Trigger edit popup with password via header override (simpler: reopen form and store pwd globally?)
      const w = window.open(`/reservation-form?roomId=${roomId}&editId=${reservation.id}`,'reservationForm','width=1040,height=760,scrollbars=yes,resizable=yes');
      if (w) w.focus();
      // Temporär im sessionStorage Passwort speichern für spätere Nutzung durch Formular (sicherheitsbewusst begrenzen)
      try { sessionStorage.setItem('reservationEditPwd_'+reservation.id, pwd); } catch(e){}
      closePasswordModal();
    } else if (passwordModal.mode === 'delete') {
      // Delete directly
      try {
        const resp = await fetch(`/api/reservations?id=${reservation.id}`, { method: 'DELETE', headers: { 'x-deletion-password': pwd } });
        if (resp.ok) {
          dispatch({ type: 'DELETE_RESERVATION', payload: reservation.id });
          loadReservations();
        } else {
          const err = await resp.json().catch(()=>({}));
          alert('Löschen fehlgeschlagen: '+(err.error||resp.status));
        }
      } catch(e) { alert('Netzwerkfehler beim Löschen'); }
      closePasswordModal();
    }
  };

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
        console.log('Füge Reservierungen hinzu (Batch):', event.data.payload);
        const successes = [];
        const failures = [];
        const items = Array.isArray(event.data.payload) ? event.data.payload : [];
        for (let idx = 0; idx < items.length; idx++) {
          const reservation = items[idx];
          const requestBody = {
            roomId: reservation.roomId,
            title: reservation.title,
            startTime: reservation.startTime,
            endTime: reservation.endTime,
            organizer: 'System',
            attendees: 0,
            description: reservation.description || ''
            ,requireDeletionPassword: reservation.requireDeletionPassword,
            deletionPassword: reservation.deletionPassword,
            // Serien-Metadaten weiterreichen
            seriesId: reservation.seriesId,
            seriesIndex: reservation.seriesIndex,
            seriesTotal: reservation.seriesTotal
          };
          try {
            const response = await fetch('/api/reservations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody)
            });
            if (response.ok) {
              const ok = await response.json();
              successes.push({ index: idx, id: ok?.data?.id, title: reservation.title });
            } else {
              const err = await response.json().catch(()=>({ error: response.statusText }));
              console.error('Fehler beim Speichern:', err);
              failures.push({ index: idx, title: reservation.title, error: err?.error || response.statusText || 'Unbekannter Fehler' });
            }
          } catch (e) {
            console.error('Netzwerkfehler beim Speichern:', e);
            failures.push({ index: idx, title: reservation.title, error: 'Netzwerkfehler' });
          }
        }
        if (successes.length) {
          await loadReservations(); // ein Reload reicht
        }
        console.log('Batch abgeschlossen. Erfolgreich:', successes.length);
        // Ergebnis an das Formular zurücksenden
        try {
          if (event.source && typeof event.source.postMessage === 'function') {
            event.source.postMessage({
              type: 'ADD_RESERVATIONS_RESULT',
              payload: { successes, failures }
            }, window.location.origin);
          }
        } catch (_) {}
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
            // If reservation is protected, ask for password
            let headers = { 'Content-Type': 'application/json' };
            const reservation = reservations.find(r => r.id === event.data.payload.id);
            if (reservation && reservation.hasDeletionPassword) {
              const pwd = prompt('Dieser Termin ist mit einem Passwort geschützt. Passwort zum Bearbeiten eingeben:');
              if (pwd === null) return; // Abbrechen
              headers['x-deletion-password'] = pwd;
            }

            const scope = event.data.payload.scope || 'single';
            const putUrl = scope && scope !== 'single' ? `/api/reservations?scope=${scope}` : '/api/reservations';
            const response = await fetch(putUrl, {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                id: event.data.payload.id,
                roomId: event.data.payload.roomId,
                title: event.data.payload.title,
                startTime: event.data.payload.startTime,
                endTime: event.data.payload.endTime,
                organizer: 'System', // Fallback
                attendees: 0, // Fallback
                description: event.data.payload.description || '',
                seriesId: event.data.payload.seriesId,
                seriesIndex: event.data.payload.seriesIndex,
                seriesTotal: event.data.payload.seriesTotal
              })
            });

          if (response.ok) {
            const result = await response.json();
            console.log('Reservierung erfolgreich aktualisiert:', result.data);
            
            // Reservierungen aus der API neu laden
            await loadReservations();
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
      else if (event.data.type === 'RESERVATION_DELETED') {
        console.log('Reservation gelöscht ID:', event.data.payload);
        dispatch({ type: 'DELETE_RESERVATION', payload: parseInt(event.data.payload) });
        // optional neu laden
        loadReservations();
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
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Zurück zur Raumübersicht
          </Link>
        </div>
      </div>
    );
  }

  const roomReservations = getReservationsForRoom(reservations, room.id);

  const renderSeriesBadge = (r) => {
    if (!r.seriesId) return null;
    return (
      <span className="ml-2 inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
        Serie {r.seriesIndex}/{r.seriesTotal}
      </span>
    );
  };

  const handleDeleteReservation = async (reservationId) => {
    if (!confirm('Termin wirklich löschen?')) return;
    const reservation = reservations.find(r => r.id === reservationId);
    if (reservation && reservation.hasDeletionPassword) {
      openPasswordModal('delete', reservationId, 'delete');
      return;
    }
    try {
      // Hole aktuelle Reservierung vom Server, um sicherzustellen, ob ein Löschpasswort gesetzt ist
      let headers = {};
      let serverReservation = null;
      try {
        const resp = await fetch('/api/reservations');
        if (resp.ok) {
          const json = await resp.json();
          const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
          serverReservation = list.find(r => parseInt(r.id) === parseInt(reservationId));
        }
      } catch (e) {
        // ignore - fallback to local data
      }

      const reservation = serverReservation || reservations.find(r => r.id === reservationId);
      if (reservation && reservation.hasDeletionPassword) {
        const pwd = prompt('Dieser Termin ist mit einem Löschpasswort geschützt. Bitte Passwort eingeben:');
        if (pwd === null) return; // abgebrochen
        headers['x-deletion-password'] = pwd;
      }
      const resp = await fetch(`/api/reservations?id=${reservationId}`, { method: 'DELETE', headers });
      if (resp.ok) {
  dispatch({ type: 'DELETE_RESERVATION', payload: reservationId });
      } else {
        const err = await resp.json().catch(()=>({}));
        alert('Löschen fehlgeschlagen: ' + (err.error || resp.status));
      }
    } catch(e) {
      alert('Netzwerkfehler beim Löschen');
    }
  };

  // Edit über detailPopupReservation -> editingReservation; separate Funktion nicht nötig

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
          <Link href="/" className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <> 
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="mr-4 p-2 hover:bg-gray-100 rounded-md">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
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
                onClick={() => setShowNewOverlay(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center font-medium"
              >
                <Plus className="w-5 h-5 mr-2" />
                Reservieren
              </button>
                {/* Serie analysieren (Dry-Run) */}
                <button
                  onClick={async () => {
                    try {
                      const anySeries = reservations.find(r => parseInt(r.roomId) === parseInt(roomId) && r.seriesId);
                      const mode = confirm('Nur zukünftige Wochen analysieren? (OK = nur Zukunft, Abbrechen = gesamte Serie)') ? 'future' : 'all';
                      if (anySeries) {
                        const seriesId = anySeries.seriesId;
                        const resp = await fetch('/api/reservations/series-repair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seriesId, mode, dryRun: true }) });
                        const json = await resp.json();
                        if (!resp.ok) { alert('Diagnose-Fehler: ' + (json.error || resp.status)); return; }
                        const weeks = Array.isArray(json.weeks) ? json.weeks : [];
                        const present = weeks.filter(w => w.status === 'present').length;
                        const missing = weeks.filter(w => w.status === 'missing').length;
                        const conflicts = weeks.filter(w => w.status === 'conflict');
                        const conflictCount = conflicts.length;
                        const conflictLines = conflicts.slice(0,5).map(w => `- Woche ${w.idx} (${w.date}) mit "${w.conflictTitle || 'Konflikt'}"`).join('\n');
                        const more = conflictCount > 5 ? `\n… und ${conflictCount - 5} weitere Konflikte` : '';
                        alert(`Serie analysiert (Modus: ${mode}).\nVorhanden: ${present}\nFehlend: ${missing}\nKonflikte: ${conflictCount}${conflictLines ? '\n' + conflictLines : ''}${more}`);
                        setAnalysisConflicts(conflicts);
                        setAnalysisMode(mode);
                      } else {
                        // Musterbasierte Diagnose: Donnerstag (4), 5. Stunde (11:20-12:10) und 5b (12:10-13:00)
                        const startHHMM = '11:20';
                        const endHHMM = '13:00';
                        const resp = await fetch('/api/reservations/pattern-diagnose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: parseInt(roomId), weekday: 4, startHHMM, endHHMM, mode, totalWeeks: 40 }) });
                        const json = await resp.json();
                        if (!resp.ok) { alert('Diagnose-Fehler: ' + (json.error || resp.status)); return; }
                        const s = json.summary || {};
                        const conflicts = (json.weeks || []).filter(w => w.status === 'conflict');
                        const conflictLines = conflicts.slice(0,5).map(w => `- Woche ${w.idx} (${w.date}) mit "${w.conflictTitle || 'Konflikt'}"`).join('\n');
                        const more = conflicts.length > 5 ? `\n… und ${conflicts.length - 5} weitere Konflikte` : '';
                        alert(`Muster-Diagnose (Do 5a+5b, Modus: ${mode})\nVorhanden: ${s.present||0}\nFehlend: ${s.missing||0}\nKonflikte: ${s.conflicts||0}${conflictLines ? '\n' + conflictLines : ''}${more}`);
                        setAnalysisConflicts(conflicts);
                        setAnalysisMode(mode);
                      }
                    } catch (e) {
                      alert('Netzwerkfehler bei Serien-Diagnose');
                    }
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 font-medium"
                >
                  Serie analysieren
                </button>
                {/* Serien-Reparatur Button: nur sichtbar wenn der Raum Serientermine hat */}
                <button
                  onClick={async () => {
                    try {
                      const anySeries = reservations.find(r => parseInt(r.roomId) === parseInt(roomId) && r.seriesId);
                      if (!anySeries) { alert('Keine Serientermine in diesem Raum gefunden.'); return; }
                      const seriesId = anySeries.seriesId;
                      const mode = confirm('Nur zukünftige Lücken füllen? (OK = nur Zukunft, Abbrechen = gesamte Serie)') ? 'future' : 'all';
                      let assumedTotal = prompt('Wie viele Wochen sollte die Serie insgesamt haben? (leer lassen, wenn unbekannt)', '40');
                      if (assumedTotal !== null && assumedTotal !== '') {
                        const n = parseInt(assumedTotal, 10);
                        if (isNaN(n) || n < 1 || n > 60) { alert('Ungültige Wochenzahl. Vorgang abgebrochen.'); return; }
                        assumedTotal = n;
                      } else {
                        assumedTotal = undefined;
                      }
                      const resp = await fetch('/api/reservations/series-repair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seriesId, mode, assumedTotal }) });
                      const json = await resp.json();
                      if (resp.ok) {
                        alert(`Serie repariert: ${json.inserted} fehlende Woche(n) ergänzt.`);
                        await loadReservations();
                      } else {
                        alert('Fehler: ' + (json.error || resp.status));
                      }
                    } catch (e) {
                      alert('Netzwerkfehler bei Serien-Reparatur');
                    }
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Serie reparieren
                </button>
            </div>
          </div>
        </div>
      </header>

      <main className="py-8">
        {analysisConflicts && analysisConflicts.length > 0 && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-yellow-800">Konflikte gefunden ({analysisConflicts.length}){analysisMode ? ` – Modus: ${analysisMode}` : ''}</div>
                <div className="text-yellow-700 text-sm">Klicke auf "Zur Woche", um direkt zur betroffenen Woche zu springen.</div>
              </div>
              <button onClick={() => setAnalysisConflicts([])} className="text-yellow-800 hover:text-yellow-900 text-sm">Schließen</button>
            </div>
            <ul className="mt-2 space-y-2 max-h-48 overflow-auto pr-1">
              {analysisConflicts.map((w, i) => (
                <li key={i} className="flex items-center justify-between bg-white border border-yellow-200 rounded p-2 text-sm">
                  <div>
                    <div className="font-medium text-gray-800">Woche {w.idx} – {w.date}</div>
                    <div className="text-gray-600">Konflikt mit: {w.conflictTitle || 'Unbekannt'}</div>
                  </div>
                  <button
                    className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    onClick={() => {
                      // zur betroffenen Woche springen
                      try {
                        const d = new Date(w.date + 'T00:00:00');
                        const weekStart = startOfWeek(d, { weekStartsOn: 1 });
                        setCurrentWeek(weekStart);
                      } catch (_) {}
                    }}
                  >
                    Zur Woche
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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

  {/* Wochenkalender mit kleinem Rand links/rechts */}
  <div className="bg-white shadow-md mx-2 sm:mx-3 lg:mx-4 overflow-hidden">
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

          {/* Wochentabelle - passt sich Containerbreite an */}
          <table className="w-full" style={{ 
            tableLayout: 'fixed', 
            width: '100%',
            border: '2px solid #374151',
            borderCollapse: 'collapse'
          }}>
            {/* Header mit Wochentagen */}
            <thead>
              <tr>
        <th className="p-2 text-[11px] font-medium text-gray-500 bg-gray-50" 
                    style={{ 
                      width: '80px',
          borderBottom: '2px solid #374151',
          borderRight: '2px solid #6B7280'
                    }}>
                  Zeit
                </th>
                {weekDays.map(day => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th key={day.toISOString()} 
                        className={`p-2 text-center ${
                          isToday ? 'bg-blue-50' : 'bg-gray-50'
                        }`}
                        style={{ 
                          width: 'calc((100% - 80px) / 7)',
                          borderBottom: '2px solid #374151',
                          borderRight: '2px solid #6B7280'
                        }}>
                      <div className={`text-[11px] font-medium ${
                        isToday ? 'text-blue-600' : 'text-gray-700'
                      }`}>
                        {format(day, 'EEE', { locale: de })}
                      </div>
                      <div className={`text-sm font-semibold ${
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
                {schoolPeriods.map((period, periodIndex) => {
                  // Dauer der Periode berechnen
                  const [sh, sm] = period.startTime.split(':').map(Number);
                  const [eh, em] = period.endTime.split(':').map(Number);
                  const minutes = (eh * 60 + em) - (sh * 60 + sm);
                  // Skalierung: 25min = 28px, 50min = 56px (linear)
                  const pxPerMinute = 28 / 25; // 1.12 px pro Minute
                  const rowHeight = Math.max(20, Math.round(minutes * pxPerMinute));
                  return (
                  <tr key={period.id} 
                      style={{
                        borderTop: '2px solid #374151'
                      }}>
                    {/* Stunden-Spalte */}
                    <td className="p-1.5 text-[11px] text-gray-500 bg-gray-50 text-center font-medium" style={{ 
                      width: '80px',
                      borderRight: '1px solid #9CA3AF'
                    }}>
                      <div className="font-semibold text-[10px] text-gray-700 leading-tight">{period.name}</div>
                      <div className="text-[10px] leading-tight">{period.time}</div>
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
                              height: `${rowHeight}px`,
                              width: 'calc((100% - 80px) / 7)',
                              borderRight: '1px solid #D1D5DB',
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
                                const w = window.open(`/reservation-form?roomId=${roomId}&editId=${reservation.id}`, 'reservationForm', 'width=1040,height=760,scrollbars=yes,resizable=yes');
                                if (w) w.focus();
                              } else {
                                const formattedDate = format(day, 'yyyy-MM-dd');
                                const periodData = schoolPeriods[periodIndex];
                                const startPeriodId = periodData.id;
                                const endPeriodId = periodData.id;
                                const w = window.open(`/reservation-form?roomId=${roomId}&date=${formattedDate}&startPeriodId=${startPeriodId}&endPeriodId=${endPeriodId}`, 'reservationForm', 'width=1040,height=760,scrollbars=yes,resizable=yes');
                                if (w) w.focus();
                              }
                            }}>

                          {/* Schulstunden-Balken für reservierte Zeitabschnitte */}
                          {isReserved && (
                            <div 
                              className="reservation-bar absolute"
                              style={{
                                left: '0px',
                                right: '0px',
                                width: '100%',
                                height: reservedHalf === 'both' ? '100%' : '50%',
                                backgroundColor: '#3B82F6', // Einheitliches Blau für alle Termine
                                top: reservedHalf === 'second' ? '50%' : '0%',
                                opacity: 0.85,
                                border: '1px solid rgba(29,78,216,0.6)',
                                margin: '0',
                                padding: '0',
                                zIndex: 2,
                                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)'
                              }}>
                              {/* Titel nur anzeigen wenn ganze Stunde oder erste Periode */}
                              {(reservedHalf === 'both' || reservedHalf === 'first') && isFirstPeriodOfReservation && (
                                <div className="text-white text-[10px] px-1 py-0.5 font-medium overflow-hidden drop-shadow-sm leading-snug flex items-center gap-1">
                                  <span>{reservation.title}</span>
                                  {reservation.seriesId && (
                                    <span className="bg-indigo-500 text-[9px] px-1.5 py-0.5 rounded">{reservation.seriesIndex}/{reservation.seriesTotal}</span>
                                  )}
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
                                fontSize: '18px',
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
                  );
                })}
              </tbody>
            </table>
        </div>
      </main>

      <PasswordModal
        open={passwordModal.open}
        title={passwordModal.mode === 'delete' ? 'Löschpasswort eingeben' : 'Passwort erforderlich'}
        message={passwordModal.mode === 'delete' ? 'Dieser Termin ist geschützt. Bitte Löschpasswort eingeben.' : 'Dieser Termin ist geschützt. Bitte Passwort eingeben.'}
        onSubmit={handlePasswordSubmit}
        onCancel={closePasswordModal}
      />
    </>
  );
};

export default SimpleRoomDetailPage;

// Detail Ansicht
function ReservationDetail({ reservation, onEdit, onDelete }) {
  const endTime = new Date(reservation.endTime);
  return (
    <div>
      <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">📋 {reservation.title} {reservation.seriesId && (
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">Serie {reservation.seriesIndex}/{reservation.seriesTotal}</span>
      )}</h3>
      <div className="space-y-3 mb-6">
        <div><span className="font-semibold">Von:</span> {new Date(reservation.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
        <div><span className="font-semibold">Bis:</span> {endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
        {reservation.description && <div><span className="font-semibold">Beschreibung:</span> {reservation.description}</div>}
      </div>
      <div className="flex gap-4">
        <button onClick={() => onEdit(reservation)} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">Bearbeiten</button>
        <button onClick={() => onDelete(reservation.id)} className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700">Löschen</button>
      </div>
    </div>
  );
}

function EditReservationModal({ reservation, onDone }) {
  const [title, setTitle] = useState(reservation.title);
  const [description, setDescription] = useState(reservation.description || '');
  const [start, setStart] = useState(reservation.startTime.slice(11,16));
  const [end, setEnd] = useState(reservation.endTime.slice(11,16));
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (saving) return; setSaving(true);
    try {
      const body = { id: reservation.id, roomId: reservation.roomId, title, description, startTime: start, endTime: end, date: reservation.startTime.slice(0,10) };
      const resp = await fetch('/api/reservations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) throw new Error((await resp.json().catch(()=>({}))).error || resp.status);
      await onDone();
    } catch(err) {
      alert('Fehler: ' + err.message);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <h3 className="text-2xl font-bold">Termin bearbeiten</h3>
      <div>
        <label className="block text-sm font-medium mb-1">Titel</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full border rounded px-3 py-2" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start</label>
          <input value={start} onChange={e=>setStart(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ende</label>
          <input value={end} onChange={e=>setEnd(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Beschreibung</label>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
      </div>
      <div className="flex justify-end">
        <button disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Speichert...' : 'Speichern'}</button>
      </div>
    </form>
  );
}

function NewReservationModal({ roomId, presetDate, presetStartHour, onSaved }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(presetDate || new Date().toISOString().slice(0,10));
  const [start, setStart] = useState(presetStartHour != null ? String(presetStartHour).padStart(2,'0') + ':00' : '08:00');
  const [end, setEnd] = useState(presetStartHour != null ? String(presetStartHour).padStart(2,'0') + ':45' : '08:45');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault(); if (saving) return; setSaving(true);
    try {
      const body = { roomId: parseInt(roomId), title, description, date, startTime: start, endTime: end };
      const resp = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) throw new Error((await resp.json().catch(()=>({}))).error || resp.status);
      await onSaved();
    } catch(err) { alert('Fehler: ' + err.message); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <h3 className="text-2xl font-bold">Neuer Termin</h3>
      <div>
        <label className="block text-sm font-medium mb-1">Datum</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full border rounded px-3 py-2" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Titel</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full border rounded px-3 py-2" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start</label>
          <input value={start} onChange={e=>setStart(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ende</label>
          <input value={end} onChange={e=>setEnd(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Beschreibung</label>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
      </div>
      <div className="flex justify-end">
        <button disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Speichert...' : 'Speichern'}</button>
      </div>
    </form>
  );
}
