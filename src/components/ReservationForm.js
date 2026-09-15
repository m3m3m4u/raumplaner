'use client';

import { useState, useEffect } from 'react';
import { useRooms } from '../contexts/RoomContext';
import { isRoomAvailable, getLocalDateTime } from '../lib/roomData';
import { CalendarDays, Clock, Users, MapPin, Settings } from 'lucide-react';

const ReservationForm = ({ selectedRoom = null, onClose, editReservation = null }) => {
  const { rooms, reservations, dispatch } = useRooms();
  const [formData, setFormData] = useState(() => {
    // Prefill robust gegen Zeitzonen: nutze explizites date und Original-HH:MM wenn vorhanden
    const prefillDate = editReservation?.date || (editReservation?.startTime ? new Date(editReservation.startTime).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    const startDt = editReservation ? (getLocalDateTime(editReservation, 'start') || new Date(editReservation.startTime)) : null;
    const endDt = editReservation ? (getLocalDateTime(editReservation, 'end') || new Date(editReservation.endTime)) : null;
    return {
      roomId: editReservation?.roomId || selectedRoom?.id || '',
      title: editReservation?.title || '',
      date: prefillDate,
      startHour: editReservation ? (startDt ? startDt.getHours() : 8) : 8,
      endHour: editReservation ? (endDt ? endDt.getHours() : 9) : 9,
      description: editReservation?.description || '',
      recurrenceType: 'once',
      weeklyCount: 1
    };
  });
  const [selectedWeeks, setSelectedWeeks] = useState(() => {
    const count = Math.max(1, parseInt(formData.weeklyCount) || 1);
    return Array.from({ length: count }, (_, i) => i);
  });

  // Synchronisiere selectedWeeks wenn weeklyCount sich ändert
  useEffect(() => {
    if (formData.recurrenceType !== 'weekly') return;
    const count = Math.max(1, parseInt(formData.weeklyCount) || 1);
    setSelectedWeeks(prev => {
      const existing = prev.filter(w => w < count);
      const maxPrev = prev.length > 0 ? Math.max(...prev) : -1;
      const added = [];
      for (let i = 0; i < count; i++) {
        if (i > maxPrev && !existing.includes(i)) {
          added.push(i);
        }
      }
      const combined = [...existing, ...added].sort((a, b) => a - b);
      return combined.length > 0 ? combined : (prev.length === 0 ? [] : [0]);
    });
  }, [formData.weeklyCount, formData.recurrenceType]);

  const toggleWeek = (weekIndex) => {
    setSelectedWeeks(prev => {
      const next = prev.includes(weekIndex)
        ? prev.filter(w => w !== weekIndex)
        : [...prev, weekIndex].sort((a, b) => a - b);
      if (errors.selectedWeeks && next.length > 0) {
        setErrors(errs => ({ ...errs, selectedWeeks: '' }));
      }
      return next;
    });
  };

  const selectAllWeeks = () => {
    const count = Math.max(1, parseInt(formData.weeklyCount) || 1);
    setSelectedWeeks(Array.from({ length: count }, (_, i) => i));
    if (errors.selectedWeeks) {
      setErrors(errs => ({ ...errs, selectedWeeks: '' }));
    }
  };

  const deselectAllWeeks = () => {
    setSelectedWeeks([]);
  };

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.roomId) newErrors.roomId = 'Raum ist erforderlich';
    if (!formData.title) newErrors.title = 'Titel ist erforderlich';
    if (!formData.date) newErrors.date = 'Datum ist erforderlich';
    if (formData.startHour >= formData.endHour) newErrors.endHour = 'Endstunde muss nach der Startstunde liegen';
    
    if (formData.recurrenceType === 'weekly') {
      if (!formData.weeklyCount || formData.weeklyCount < 1) {
        newErrors.weeklyCount = 'Anzahl Wochen muss mindestens 1 sein';
      }
      const activeSelected = selectedWeeks.filter(w => w < (parseInt(formData.weeklyCount) || 1));
      if (activeSelected.length === 0) {
        newErrors.selectedWeeks = 'Mindestens ein Termin muss ausgewählt sein';
      }
    }
    
    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      newErrors.date = 'Datum kann nicht in der Vergangenheit liegen';
    }
    
    // Verfügbarkeit prüfen (vereinfacht für Stunden)
    const shouldCheckStartDate = formData.recurrenceType === 'once' || selectedWeeks.includes(0);
    if (shouldCheckStartDate) {
      const startDateTime = new Date(formData.date);
      startDateTime.setHours(formData.startHour, 0, 0, 0);
      const endDateTime = new Date(formData.date);
      endDateTime.setHours(formData.endHour, 0, 0, 0);
      
      if (formData.roomId && !isRoomAvailable(
        rooms, 
        reservations, 
        parseInt(formData.roomId), 
        startDateTime, 
        endDateTime, 
        editReservation?.id
      )) {
        newErrors.roomId = 'Raum ist zu dieser Zeit bereits reserviert';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (editReservation) {
      // Bearbeitung von bestehenden Reservierungen
      const startDateTime = new Date(formData.date);
      startDateTime.setHours(formData.startHour, 0, 0, 0);
      const endDateTime = new Date(formData.date);
      endDateTime.setHours(formData.endHour, 0, 0, 0);
      
      const reservationData = {
        ...formData,
        roomId: parseInt(formData.roomId),
        startTime: startDateTime,
        endTime: endDateTime
      };
      
      dispatch({
        type: 'UPDATE_RESERVATION',
        payload: { ...reservationData, id: editReservation.id }
      });
    } else {
      // Neue Reservierung(en) erstellen
      if (formData.recurrenceType === 'once') {
        // Einmalige Reservierung
        const startDateTime = new Date(formData.date);
        startDateTime.setHours(formData.startHour, 0, 0, 0);
        const endDateTime = new Date(formData.date);
        endDateTime.setHours(formData.endHour, 0, 0, 0);
        
        const reservationData = {
          ...formData,
          roomId: parseInt(formData.roomId),
          startTime: startDateTime,
          endTime: endDateTime
        };
        
        dispatch({
          type: 'ADD_RESERVATION',
          payload: reservationData
        });
      } else if (formData.recurrenceType === 'weekly') {
        // Wöchentliche Reservierungen erstellen (nur für ausgewählte Wochen)
        const weeklyCount = parseInt(formData.weeklyCount);
        const activeSelectedWeeks = selectedWeeks.filter(w => w < weeklyCount);
        
        for (const week of activeSelectedWeeks) {
          const weeklyDate = new Date(formData.date);
          weeklyDate.setDate(weeklyDate.getDate() + (week * 7));
          
          const startDateTime = new Date(weeklyDate);
          startDateTime.setHours(formData.startHour, 0, 0, 0);
          const endDateTime = new Date(weeklyDate);
          endDateTime.setHours(formData.endHour, 0, 0, 0);
          
          const reservationData = {
            ...formData,
            roomId: parseInt(formData.roomId),
            startTime: startDateTime,
            endTime: endDateTime,
            title: `${formData.title} (Woche ${week + 1}/${weeklyCount})`
          };
          
          dispatch({
            type: 'ADD_RESERVATION',
            payload: reservationData
          });
        }
      }
    }
    
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Fehler für dieses Feld löschen
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {editReservation ? '✏️ Termin bearbeiten' : '➕ Neuen Termin erstellen'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
        <h2 className="text-2xl font-bold mb-6">
          {editReservation ? 'Reservierung bearbeiten' : 'Neue Reservierung'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              <MapPin className="inline w-4 h-4 mr-1" />
              Raum
            </label>
            <select
              name="roomId"
              value={formData.roomId}
              onChange={handleChange}
              className={`w-full p-2 border rounded-md ${errors.roomId ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Raum auswählen...</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name} (Kapazität: {room.capacity})
                </option>
              ))}
            </select>
            {errors.roomId && <p className="text-red-500 text-sm mt-1">{errors.roomId}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Titel</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`w-full p-2 border rounded-md ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Titel der Veranstaltung"
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          {/* Wiederholung Auswahl */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="text-sm font-medium mb-3">Wiederholung:</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="once"
                  name="recurrenceType"
                  value="once"
                  checked={formData.recurrenceType === 'once'}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <label htmlFor="once" className="text-sm font-medium">
                  Einmalig
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="weekly"
                  name="recurrenceType"
                  value="weekly"
                  checked={formData.recurrenceType === 'weekly'}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <label htmlFor="weekly" className="text-sm font-medium">
                  Wöchentlich wiederholen
                </label>
              </div>
              
              {formData.recurrenceType === 'weekly' && (
                <div className="ml-6 flex items-center gap-2">
                  <label className="text-sm">Anzahl Wochen:</label>
                  <input
                    type="number"
                    name="weeklyCount"
                    value={formData.weeklyCount}
                    onChange={handleChange}
                    min="1"
                    max="52"
                    className="w-20 p-1 border border-gray-300 rounded text-center"
                  />
                  <span className="text-sm text-gray-600">
                    (max. 52 Wochen)
                  </span>
                </div>
              )}
            </div>
            
            {/* Vorschau & Terminauswahl */}
            {formData.recurrenceType === 'weekly' && formData.date && (
              <div className="mt-3 p-3 bg-white rounded border border-green-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100">
                  <div>
                    <h5 className="text-xs font-semibold text-gray-800">Termine auswählen:</h5>
                    <p className="text-[11px] text-gray-500">
                      {selectedWeeks.filter(w => w < (parseInt(formData.weeklyCount) || 1)).length} von {Math.max(1, parseInt(formData.weeklyCount) || 1)} Terminen ausgewählt
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllWeeks}
                      className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition-colors"
                    >
                      Alle
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllWeeks}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-medium transition-colors"
                    >
                      Keine
                    </button>
                  </div>
                </div>

                {errors.selectedWeeks && (
                  <div className="mb-2 p-1.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                    {errors.selectedWeeks}
                  </div>
                )}

                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {Array.from({ length: Math.max(1, parseInt(formData.weeklyCount) || 1) }, (_, week) => {
                    const date = new Date(formData.date);
                    date.setDate(date.getDate() + (week * 7));
                    const isSelected = selectedWeeks.includes(week);
                    const formattedDate = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

                    return (
                      <div
                        key={week}
                        onClick={() => toggleWeek(week)}
                        className={`flex items-center justify-between p-2 rounded border cursor-pointer select-none text-xs transition-all duration-150 ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-200 text-gray-800 hover:bg-blue-50'
                            : 'bg-gray-50/80 border-gray-200 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 pointer-events-none"
                          />
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isSelected ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-gray-200 text-gray-500 border border-gray-300'
                          }`}>
                            Woche {week + 1}
                          </span>
                          <span className={isSelected ? 'font-medium text-gray-900' : 'line-through text-gray-400'}>
                            {formattedDate}
                          </span>
                          <span className={isSelected ? 'text-gray-600' : 'line-through text-gray-400'}>
                            {formData.startHour}:00 – {formData.endHour}:00
                          </span>
                        </div>
                        <div>
                          {isSelected ? (
                            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Wird gebucht
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300">
                              Gestrichen
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Datum</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={`w-full p-2 border rounded-md ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                <Clock className="inline w-4 h-4 mr-1" />
                Von Stunde
              </label>
              <select
                name="startHour"
                value={formData.startHour}
                onChange={handleChange}
                className={`w-full p-2 border rounded-md ${errors.startHour ? 'border-red-500' : 'border-gray-300'}`}
              >
                {Array.from({ length: 14 }, (_, i) => i + 8).map(hour => (
                  <option key={hour} value={hour}>
                    {hour}:00 - {hour}:50 ({hour - 7}. Stunde)
                  </option>
                ))}
              </select>
              {errors.startHour && <p className="text-red-500 text-sm mt-1">{errors.startHour}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                <Clock className="inline w-4 h-4 mr-1" />
                Bis Stunde
              </label>
              <select
                name="endHour"
                value={formData.endHour}
                onChange={handleChange}
                className={`w-full p-2 border rounded-md ${errors.endHour ? 'border-red-500' : 'border-gray-300'}`}
              >
                {Array.from({ length: 14 }, (_, i) => i + 8).map(hour => (
                  <option key={hour} value={hour}>
                    {hour}:00 - {hour}:50 ({hour - 7}. Stunde)
                  </option>
                ))}
              </select>
              {errors.endHour && <p className="text-red-500 text-sm mt-1">{errors.endHour}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Zusätzliche Informationen..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {editReservation ? 'Aktualisieren' : 'Reservieren'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationForm;
