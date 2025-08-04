'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, Users, MapPin, X } from 'lucide-react';
import { useRooms } from '../contexts/RoomContext';

const ReservationFormPage = () => {
  const { schedule } = useRooms();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const editId = searchParams.get('editId');
  const isEditing = !!editId;

  // Schulstunden-Definitionen - nutzt Schedule aus Context
  const getSchoolPeriods = useCallback(() => {
    console.log('ReservationFormPage - Schedule from Context:', schedule); // Debug
    
    return schedule.map(slot => ({
      id: slot.id,
      name: slot.name,
      startHour: parseInt(slot.startTime.split(':')[0]),
      startTime: slot.startTime,
      endTime: slot.endTime,
      time: `${slot.startTime} - ${slot.endTime}`
    }));
  }, [schedule]);

  // Hilfsfunktion um die korrekten Start- und Endzeiten für Schulstunden zu berechnen
  const calculateSchoolHourTimes = (startPeriodId, endPeriodId, date) => {
    console.log('calculateSchoolHourTimes called with:', { startPeriodId, endPeriodId, date });
    
    // Validierung der Eingabeparameter
    if (!startPeriodId || !endPeriodId || !date) {
      console.error('Periode nicht gefunden: Fehlende Parameter', { startPeriodId, endPeriodId, date });
      return null;
    }
    
    const periods = getSchoolPeriods();
    
    // Finde Start-Periode basierend auf ID
    const startPeriod = periods.find(p => p.id === parseInt(startPeriodId));
    
    // Finde End-Periode basierend auf ID
    const endPeriod = periods.find(p => p.id === parseInt(endPeriodId));
    
    if (!startPeriod || !endPeriod) {
      console.error('Periode nicht gefunden:', { 
        startPeriodId: parseInt(startPeriodId), 
        endPeriodId: parseInt(endPeriodId), 
        startPeriod: startPeriod || 'undefined', 
        endPeriod: endPeriod || 'undefined',
        availablePeriods: periods.map(p => ({ id: p.id, name: p.name }))
      });
      return null;
    }
    
    // Start-Zeit aus der Periode verwenden
    const [startH, startM] = startPeriod.startTime.split(':').map(Number);
    const startDateTime = new Date(date);
    startDateTime.setHours(startH, startM, 0, 0);
    
    // End-Zeit aus der Periode verwenden
    const [endH, endM] = endPeriod.endTime.split(':').map(Number);
    const endDateTime = new Date(date);
    endDateTime.setHours(endH, endM, 0, 0);
    
    console.log('Berechnete Zeiten:', {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString()
    });
    
    return { startDateTime, endDateTime };
  };
  const [formData, setFormData] = useState(() => {
    // URL-Parameter für vorausgefüllte Daten
    const prefilledDate = searchParams.get('date');
    const prefilledStartHour = searchParams.get('startHour');
    const prefilledEndHour = searchParams.get('endHour');
    
    // Konvertiere Stunden zu Periode-IDs falls verfügbar
    const periods = schedule.length > 0 ? schedule.map(slot => ({
      id: slot.id,
      startHour: parseInt(slot.startTime.split(':')[0])
    })) : [];
    
    const defaultStartPeriod = periods.find(p => p.startHour === (prefilledStartHour ? parseInt(prefilledStartHour) : 8));
    const defaultEndPeriod = periods.find(p => p.startHour === (prefilledEndHour ? parseInt(prefilledEndHour) : 9));
    
    return {
      roomId: roomId || '',
      title: '',
      date: prefilledDate || new Date().toISOString().slice(0, 10),
      startPeriod: defaultStartPeriod?.id || (periods[0]?.id || 1),
      endPeriod: defaultEndPeriod?.id || (periods[1]?.id || 2),
      description: '',
      recurrenceType: 'once',
      weeklyCount: 1
    };
  });
  
  const [errors, setErrors] = useState({});
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [conflicts, setConflicts] = useState([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  
  // Räume von der API laden
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const response = await fetch('/api/rooms');
        if (response.ok) {
          const data = await response.json();
          setRooms(Array.isArray(data) ? data : []);
        } else {
          console.error('Fehler beim Laden der Räume');
          setRooms([]);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Räume:', error);
        setRooms([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRooms();
  }, []);

  // Konflikterkennung
  const checkTimeConflicts = useCallback(async (roomId, startPeriodId, endPeriodId, date, excludeId = null) => {
    if (!roomId || !startPeriodId || !endPeriodId || !date) {
      setConflicts([]);
      return { hasConflict: false, conflicts: [] };
    }

    // Nur anzeigen wenn wirklich geprüft wird
    setIsCheckingConflicts(true);
    
    try {
      const timeResult = calculateSchoolHourTimes(startPeriodId, endPeriodId, date);
      if (!timeResult) {
        setConflicts([]);
        return { hasConflict: false, conflicts: [] };
      }

      const { startDateTime, endDateTime } = timeResult;

      const response = await fetch('/api/reservations/check-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: parseInt(roomId),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          excludeId: excludeId
        })
      });

      if (response.ok) {
        const result = await response.json();
        setConflicts(result.conflicts || []);
        return result;
      } else {
        console.error('Fehler bei Konfliktprüfung');
        setConflicts([]);
        return { hasConflict: false, conflicts: [] };
      }
    } catch (error) {
      console.error('Fehler bei Konfliktprüfung:', error);
      setConflicts([]);
      return { hasConflict: false, conflicts: [] };
    } finally {
      setIsCheckingConflicts(false);
    }
  }, [calculateSchoolHourTimes]);

  // Automatische Konflikterkennung bei Änderungen
  useEffect(() => {
    // Reset conflicts wenn nicht alle Felder ausgefüllt sind
    if (!formData.roomId || !formData.startPeriod || !formData.endPeriod || !formData.date) {
      setConflicts([]);
      setIsCheckingConflicts(false);
      return;
    }

    const checkConflicts = async () => {
      await checkTimeConflicts(
        formData.roomId, 
        formData.startPeriod, 
        formData.endPeriod, 
        formData.date,
        isEditing ? editId : null
      );
    };

    // Längerer Debounce von 1,2 Sekunden um Flackern zu verhindern
    const timeoutId = setTimeout(checkConflicts, 1200);
    return () => clearTimeout(timeoutId);
  }, [formData.roomId, formData.startPeriod, formData.endPeriod, formData.date, isEditing, editId, checkTimeConflicts]);
  
  const room = rooms.find(r => r.id === parseInt(roomId));

  // Lade Bearbeitungsdaten vom Hauptfenster
  useEffect(() => {
    if (isEditing && window.opener) {
      console.log('Bearbeitungsmodus - lade Daten für ID:', editId); // Debug
      
      // Frage Bearbeitungsdaten vom Hauptfenster an
      window.opener.postMessage({
        type: 'GET_RESERVATION_DATA',
        payload: editId
      }, window.location.origin);
      
      // Höre auf die Antwort
      const handleMessage = (event) => {
        console.log('Bearbeitungsfenster: Nachricht empfangen:', event.data); // Debug
        
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'RESERVATION_DATA' && event.data.payload) {
          const reservation = event.data.payload;
          console.log('Lade Reservierungsdaten:', reservation); // Debug
          
          const startTime = new Date(reservation.startTime);
          const endTime = new Date(reservation.endTime);
          
          // Entferne Wochennummer aus dem Titel falls vorhanden
          const cleanTitle = reservation.title.replace(/ \(Woche \d+\/\d+\)/, '');
          
          // Finde passende Perioden basierend auf der Zeit
          const periods = getSchoolPeriods();
          const startHour = startTime.getHours();
          const endHour = endTime.getHours();
          
          const startPeriod = periods.find(p => p.startHour === startHour);
          const endPeriod = periods.find(p => p.startHour === endHour);
          
          console.log('Setze Formulardaten:', {
            roomId: reservation.roomId.toString(),
            title: cleanTitle,
            date: startTime.toISOString().slice(0, 10),
            startPeriod: startPeriod?.id || periods[0]?.id,
            endPeriod: endPeriod?.id || periods[1]?.id,
            description: reservation.description || ''
          }); // Debug
          
          setFormData({
            roomId: reservation.roomId.toString(),
            title: cleanTitle,
            date: startTime.toISOString().slice(0, 10),
            startPeriod: startPeriod?.id || periods[0]?.id,
            endPeriod: endPeriod?.id || periods[1]?.id,
            description: reservation.description || '',
            recurrenceType: 'once', // Immer einmalig bei Bearbeitung
            weeklyCount: 1
          });
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [isEditing, editId, getSchoolPeriods]);

  const validateForm = async () => {
    const newErrors = {};
    
    if (!formData.roomId || formData.roomId === '') newErrors.roomId = 'Raum ist erforderlich';
    if (!formData.title) newErrors.title = 'Titel ist erforderlich';
    if (!formData.date) newErrors.date = 'Datum ist erforderlich';
    if (!formData.startPeriod) newErrors.startPeriod = 'Startperiode ist erforderlich';
    if (!formData.endPeriod) newErrors.endPeriod = 'Endperiode ist erforderlich';
    
    // Überprüfe ob End-Periode nach Start-Periode liegt (basierend auf Zeit)
    if (formData.startPeriod && formData.endPeriod) {
      const periods = getSchoolPeriods();
      const startPeriod = periods.find(p => p.id === parseInt(formData.startPeriod));
      const endPeriod = periods.find(p => p.id === parseInt(formData.endPeriod));
      
      if (startPeriod && endPeriod) {
        // Vergleiche die Start-Zeit der Startperiode mit der Start-Zeit der Endperiode
        const startTime = startPeriod.startTime;
        const endTime = endPeriod.startTime;
        
        // Konvertiere zu Minuten für einfachen Vergleich
        const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
        const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
        
        if (startMinutes > endMinutes) {
          newErrors.endPeriod = 'Endperiode muss nach oder gleich der Startperiode liegen';
        }
      }
    }
    
    if (formData.recurrenceType === 'weekly' && (!formData.weeklyCount || formData.weeklyCount < 1)) {
      newErrors.weeklyCount = 'Anzahl Wochen muss mindestens 1 sein';
    }

    // Konflikterkennung
    if (formData.roomId && formData.startPeriod && formData.endPeriod && formData.date) {
      const conflictResult = await checkTimeConflicts(
        formData.roomId, 
        formData.startPeriod, 
        formData.endPeriod, 
        formData.date,
        isEditing ? editId : null
      );
      
      if (conflictResult.hasConflict) {
        const conflictMessages = conflictResult.conflicts.map(conflict => 
          `&quot;${conflict.title}&quot; (${conflict.timeDisplay})`
        ).join(', ');
        newErrors.timeConflict = `Zeitkonflikt mit: ${conflictMessages}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const isValid = await validateForm();
    if (!isValid) return;
    
    if (isEditing) {
      // Bearbeitung: Update existierende Reservierung
      const timeResult = calculateSchoolHourTimes(
        formData.startPeriod, 
        formData.endPeriod, 
        formData.date
      );
      
      if (!timeResult) {
        alert('Fehler beim Berechnen der Zeiten. Bitte überprüfen Sie Ihre Eingaben.');
        return;
      }
      
      const { startDateTime, endDateTime } = timeResult;
      
      const updatedReservation = {
        id: parseInt(editId),
        roomId: parseInt(formData.roomId),
        title: formData.title,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        description: formData.description || ''
      };
      
      // Sende Update an das Hauptfenster
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'UPDATE_RESERVATION',
          payload: updatedReservation
        }, window.location.origin);
        
        setTimeout(() => {
          alert('Reservierung erfolgreich aktualisiert!');
          window.close();
        }, 100);
      } else {
        alert('Verbindung zum Hauptfenster verloren. Bitte versuchen Sie es erneut.');
      }
      
      return;
    }
    
    // Rest der Funktion für neue Reservierungen bleibt gleich
    const reservationsToCreate = [];
    const baseId = Date.now();
    
    if (formData.recurrenceType === 'once') {
      // Einmalige Reservierung
      const timeResult = calculateSchoolHourTimes(
        formData.startPeriod, 
        formData.endPeriod, 
        formData.date
      );
      
      if (!timeResult) {
        alert('Fehler beim Berechnen der Zeiten. Bitte überprüfen Sie Ihre Eingaben.');
        return;
      }
      
      const { startDateTime, endDateTime } = timeResult;
      
      const reservationData = {
        id: baseId,
        roomId: parseInt(formData.roomId),
        title: formData.title,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        description: formData.description || ''
      };
      
      reservationsToCreate.push(reservationData);
    } else if (formData.recurrenceType === 'weekly') {
      // Wöchentliche Reservierungen erstellen
      const weeklyCount = parseInt(formData.weeklyCount);
      
      for (let week = 0; week < weeklyCount; week++) {
        const weeklyDate = new Date(formData.date);
        weeklyDate.setDate(weeklyDate.getDate() + (week * 7));
        
        const timeResult = calculateSchoolHourTimes(
          formData.startPeriod, 
          formData.endPeriod, 
          weeklyDate.toISOString().slice(0, 10)
        );
        
        if (!timeResult) {
          alert(`Fehler beim Berechnen der Zeiten für Woche ${week + 1}. Bitte überprüfen Sie Ihre Eingaben.`);
          return;
        }
        
        const { startDateTime, endDateTime } = timeResult;
        
        const reservationData = {
          id: baseId + week + 1, // Eindeutige ID für jede Woche
          roomId: parseInt(formData.roomId),
          title: `${formData.title} (Woche ${week + 1}/${weeklyCount})`,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          description: formData.description || ''
        };
        
        reservationsToCreate.push(reservationData);
      }
    }
    
    console.log('Sende Reservierungen:', reservationsToCreate); // Debug
    
    // Sende Daten an das Hauptfenster
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        type: 'ADD_RESERVATIONS',
        payload: reservationsToCreate
      }, window.location.origin);
      
      // Kurz warten und dann schließen
      setTimeout(() => {
        alert(`${reservationsToCreate.length} Reservierung(en) erfolgreich erstellt!`);
        window.close();
      }, 100);
    } else {
      alert('Verbindung zum Hauptfenster verloren. Bitte versuchen Sie es erneut.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Fehler für dieses Feld löschen
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200">
        <div className="flex justify-between items-center p-8 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isEditing ? '✏️ Termin bearbeiten' : '➕ Neuen Termin erstellen'}
            </h1>
            <p className="text-gray-600 text-lg">
              Wählen Sie den gewünschten Raum und die Zeit aus
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-3 hover:bg-white hover:bg-opacity-50 rounded-full transition-all duration-200"
          >
            <X className="w-7 h-7" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Raumauswahl */}
          <div>
            <label className="block text-lg font-semibold mb-4 text-gray-800">
              <MapPin className="inline w-5 h-5 mr-2" />
              Raum:
            </label>
            <select
              name="roomId"
              value={formData.roomId}
              onChange={handleChange}
              disabled={isLoading}
              className={`w-full p-4 text-lg border-2 rounded-xl transition-all duration-200 ${
                errors.roomId 
                  ? 'border-red-400 bg-red-50' 
                  : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
              } ${isLoading ? 'bg-gray-100' : 'bg-white'}`}
            >
              <option value="">
                {isLoading ? "Räume werden geladen..." : "-- Raum auswählen --"}
              </option>
              {!isLoading && rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
            {errors.roomId && <p className="text-red-500 text-sm mt-2 ml-1">{errors.roomId}</p>}
          </div>

          <div>
            <label className="block text-lg font-semibold mb-4 text-gray-800">
              📝 Titel:
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`w-full p-4 text-lg border-2 rounded-xl transition-all duration-200 ${
                errors.title 
                  ? 'border-red-400 bg-red-50' 
                  : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
              }`}
              placeholder="z.B. Mathematik 9a"
            />
            {errors.title && <p className="text-red-500 text-sm mt-2 ml-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-lg font-semibold mb-4 text-gray-800">
              📅 Datum:
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={`w-full p-4 text-lg border-2 rounded-xl transition-all duration-200 ${
                errors.date 
                  ? 'border-red-400 bg-red-50' 
                  : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
              }`}
            />
            {errors.date && <p className="text-red-500 text-sm mt-2 ml-1">{errors.date}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-lg font-semibold mb-4 text-gray-800">
                <Clock className="inline w-5 h-5 mr-2" />
                Von Periode:
              </label>
              <select
                name="startPeriod"
                value={formData.startPeriod}
                onChange={handleChange}
                className="w-full p-4 text-lg border-2 border-gray-300 rounded-xl hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
              >
                {getSchoolPeriods().map(period => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.time})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-lg font-semibold mb-4 text-gray-800">
                <Clock className="inline w-5 h-5 mr-2" />
                Bis Periode:
              </label>
              <select
                name="endPeriod"
                value={formData.endPeriod}
                onChange={handleChange}
                className={`w-full p-4 text-lg border-2 rounded-xl transition-all duration-200 ${
                  errors.endPeriod 
                    ? 'border-red-400 bg-red-50' 
                    : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                }`}
              >
                {getSchoolPeriods().map(period => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.time})
                  </option>
                ))}
              </select>
              {errors.endPeriod && <p className="text-red-500 text-sm mt-2 ml-1">{errors.endPeriod}</p>}
            </div>
          </div>

          {/* Nur Konflikte anzeigen, keine "Prüfe Zeit..."-Nachricht */}
          {conflicts.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
              <h4 className="text-red-800 font-medium mb-4 text-lg">⚠️ Zeitkonflikt erkannt!</h4>
              <p className="text-red-700 text-base mb-4">
                Folgende Reservierungen überschneiden sich mit der gewählten Zeit: 
              </p>
              <ul className="space-y-3">
                {conflicts.map((conflict, index) => (
                  <li key={index} className="text-red-700 text-base bg-red-100 px-4 py-3 rounded">
                    📅 &quot;{conflict.title}&quot; von {conflict.timeDisplay}
                  </li>
                ))}
              </ul>
              <p className="text-red-700 text-base mt-4 font-medium">
                Bitte wählen Sie eine andere Zeit.
              </p>
            </div>
          )}

          {errors.timeConflict && (
            <div className="bg-red-50 border border-red-200 p-5 rounded-lg">
              <p className="text-red-700 text-lg">⚠️ {errors.timeConflict}</p>
            </div>
          )}

          <div>
            <label className="block text-lg font-medium mb-4 text-gray-700">📝 Beschreibung: </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              className="w-full p-4 border border-gray-300 rounded-lg text-lg transition-all duration-200 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Zusätzliche Informationen..."
            />
          </div>

          {/* Wiederholung - nur bei neuen Terminen */}
          {!isEditing && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h4 className="text-lg font-medium mb-6 text-gray-700">🔄 Wiederholung: </h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="once"
                  name="recurrenceType"
                  value="once"
                  checked={formData.recurrenceType === 'once'}
                  onChange={handleChange}
                  className="w-5 h-5"
                />
                <label htmlFor="once" className="text-lg font-medium">
                  📅 Einmalig
                </label>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="weekly"
                  name="recurrenceType"
                  value="weekly"
                  checked={formData.recurrenceType === 'weekly'}
                  onChange={handleChange}
                  className="w-5 h-5"
                />
                <label htmlFor="weekly" className="text-lg font-medium">
                  📆 Wöchentlich wiederholen
                </label>
              </div>
              
              {formData.recurrenceType === 'weekly' && (
                <div className="ml-8 flex items-center gap-4">
                  <label className="text-lg">Anzahl Wochen: </label>
                  <input
                    type="number"
                    name="weeklyCount"
                    value={formData.weeklyCount}
                    onChange={handleChange}
                    min="1"
                    max="52"
                    className="w-24 p-3 border border-gray-300 rounded text-center text-lg transition-all duration-200 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-lg text-gray-600">
                    (max. 52 Wochen)
                  </span>
                </div>
              )}
            </div>
            
            {/* Vorschau */}
            {formData.recurrenceType === 'weekly' && formData.date && formData.weeklyCount > 1 && (
              <div className="mt-6 p-5 bg-white rounded border">
                <h5 className="text-lg font-medium mb-4 text-gray-700">📋 Vorschau der Termine: </h5>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Array.from({ length: Math.min(parseInt(formData.weeklyCount) || 1, 10) }, (_, week) => {
                    const date = new Date(formData.date);
                    date.setDate(date.getDate() + (week * 7));
                    const endTime = formData.startHour === formData.endHour ? `${formData.endHour}:50` : `${formData.endHour}:50`;
                    return (
                      <div key={week} className="text-base text-gray-600">
                        Woche {week + 1}: {date.toLocaleDateString('de-DE')} von {formData.startHour}:00 bis {endTime}
                      </div>
                    );
                  })}
                  {parseInt(formData.weeklyCount) > 10 && (
                    <div className="text-base text-gray-500">... und {parseInt(formData.weeklyCount) - 10} weitere</div>
                  )}
                </div>
              </div>
            )}
          </div>
          )}

          <div className="flex justify-end space-x-6 pt-8 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-8 py-4 text-lg text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={conflicts.length > 0 || isCheckingConflicts}
              className={`px-8 py-4 text-lg rounded-lg transition-colors font-medium ${
                conflicts.length > 0 || isCheckingConflicts
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
              }`}
            >
              {isCheckingConflicts 
                ? 'Prüfe Konflikte...' 
                : isEditing 
                  ? 'Änderungen speichern' 
                  : 'Reservierung erstellen'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationFormPage;
