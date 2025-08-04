'use client';

import { useState } from 'react';
import { useRooms } from '../contexts/RoomContext';
import { isRoomAvailable } from '../lib/roomData';
import { CalendarDays, Clock, Users, MapPin, Settings } from 'lucide-react';

const ReservationForm = ({ selectedRoom = null, onClose, editReservation = null }) => {
  const { rooms, reservations, dispatch } = useRooms();
  const [formData, setFormData] = useState({
    roomId: editReservation?.roomId || selectedRoom?.id || '',
    title: editReservation?.title || '',
    date: editReservation ? 
      new Date(editReservation.startTime).toISOString().slice(0, 10) : 
      new Date().toISOString().slice(0, 10),
    startHour: editReservation ? 
      new Date(editReservation.startTime).getHours() : 
      8,
    endHour: editReservation ? 
      new Date(editReservation.endTime).getHours() : 
      9,
    description: editReservation?.description || '',
    recurrenceType: 'once',
    weeklyCount: 1
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.roomId) newErrors.roomId = 'Raum ist erforderlich';
    if (!formData.title) newErrors.title = 'Titel ist erforderlich';
    if (!formData.date) newErrors.date = 'Datum ist erforderlich';
    if (formData.startHour >= formData.endHour) newErrors.endHour = 'Endstunde muss nach der Startstunde liegen';
    
    if (formData.recurrenceType === 'weekly' && (!formData.weeklyCount || formData.weeklyCount < 1)) {
      newErrors.weeklyCount = 'Anzahl Wochen muss mindestens 1 sein';
    }
    
    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      newErrors.date = 'Datum kann nicht in der Vergangenheit liegen';
    }
    
    // Verfügbarkeit prüfen (vereinfacht für Stunden)
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
        // Wöchentliche Reservierungen erstellen
        const weeklyCount = parseInt(formData.weeklyCount);
        
        for (let week = 0; week < weeklyCount; week++) {
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
            <h4 className="text-sm font-medium mb-3">🔄 Wiederholung:</h4>
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
                  📅 Einmalig
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
                  📆 Wöchentlich wiederholen
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
            
            {/* Vorschau für wöchentliche Termine */}
            {formData.recurrenceType === 'weekly' && formData.date && formData.weeklyCount > 1 && (
              <div className="mt-3 p-3 bg-white rounded border">
                <h5 className="text-xs font-medium mb-2">📋 Vorschau der Termine:</h5>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {Array.from({ length: Math.min(parseInt(formData.weeklyCount) || 1, 10) }, (_, week) => {
                    const date = new Date(formData.date);
                    date.setDate(date.getDate() + (week * 7));
                    return (
                      <div key={week} className="text-xs text-gray-600">
                        Woche {week + 1}: {date.toLocaleDateString('de-DE')} von {formData.startHour}:00 bis {formData.endHour}:00
                      </div>
                    );
                  })}
                  {parseInt(formData.weeklyCount) > 10 && (
                    <div className="text-xs text-gray-500">... und {parseInt(formData.weeklyCount) - 10} weitere</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">📅 Datum</label>
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
