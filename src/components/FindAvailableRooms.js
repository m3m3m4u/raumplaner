'use client';

import { useState, useEffect } from 'react';
import { useRooms } from '../contexts/RoomContext';
import { getLocalDateTime } from '../lib/roomData';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Search, MapPin, Users, Calendar, Clock, Plus, X } from 'lucide-react';

const FindAvailableRooms = ({ isOpen, onClose }) => {
  const { rooms, reservations, schedule } = useRooms();
  const [searchData, setSearchData] = useState({
    date: new Date().toISOString().slice(0, 10),
    startPeriod: '',
    endPeriod: ''
  });
  const [availableRooms, setAvailableRooms] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Schulstunden aus Schedule
  const getSchoolPeriods = () => {
    return schedule.map(slot => ({
      id: slot.id,
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      time: `${slot.startTime} - ${slot.endTime}`
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const findAvailableRooms = () => {
    if (!searchData.date || !searchData.startPeriod || !searchData.endPeriod) {
      alert('Bitte füllen Sie alle Felder aus');
      return;
    }

    const periods = getSchoolPeriods();
    const startPeriod = periods.find(p => p.id === parseInt(searchData.startPeriod));
    const endPeriod = periods.find(p => p.id === parseInt(searchData.endPeriod));

    if (!startPeriod || !endPeriod) {
      alert('Ungültige Periode ausgewählt');
      return;
    }

    // Prüfe Zeitlogik
    const startMinutes = parseInt(startPeriod.startTime.split(':')[0]) * 60 + parseInt(startPeriod.startTime.split(':')[1]);
    const endMinutes = parseInt(endPeriod.startTime.split(':')[0]) * 60 + parseInt(endPeriod.startTime.split(':')[1]);
    
    if (startMinutes >= endMinutes) {
      alert('Endperiode muss nach der Startperiode liegen');
      return;
    }

    // Erstelle Start- und Endzeit
    const searchDate = new Date(searchData.date);
    const [startHour, startMin] = startPeriod.startTime.split(':').map(Number);
    const [endHour, endMin] = endPeriod.endTime.split(':').map(Number);
    
    const searchStart = new Date(searchDate);
    searchStart.setHours(startHour, startMin, 0, 0);
    
    const searchEnd = new Date(searchDate);
    searchEnd.setHours(endHour, endMin, 0, 0);

    // Finde verfügbare Räume
    const available = rooms.filter(room => {
      // Prüfe ob der Raum in der gewünschten Zeit frei ist
      const conflictingReservation = reservations.find(reservation => {
        if (reservation.roomId !== room.id) return false;
        
        const resStart = getLocalDateTime(reservation, 'start') || new Date(reservation.startTime);
        const resEnd = getLocalDateTime(reservation, 'end') || new Date(reservation.endTime);
        
        // Prüfe auf Überlappung
        return resStart < searchEnd && resEnd > searchStart;
      });
      
      return !conflictingReservation;
    });

    setAvailableRooms(available);
    setHasSearched(true);
  };

  const handleReserveRoom = (roomId) => {
    const periods = getSchoolPeriods();
    const startPeriod = periods.find(p => p.id === parseInt(searchData.startPeriod));
    
    // Öffne Reservierungsformular mit vorausgefüllten Daten
    const newWindow = window.open(
      `/reservation-form?roomId=${roomId}&date=${searchData.date}&startHour=${parseInt(startPeriod.startTime.split(':')[0])}`, 
      'reservationForm',
      'width=800,height=600,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no'
    );
    
    if (newWindow) {
      newWindow.focus();
    }
    
    // Schließe das Suchfenster
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-8 max-w-4xl w-full shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-3xl font-bold text-gray-900 flex items-center">
            <Search className="w-8 h-8 mr-3" />
            Freie Räume finden
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none hover:bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Suchformular */}
        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Datum
              </label>
              <input
                type="date"
                name="date"
                value={searchData.date}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Von Periode
              </label>
              <select
                name="startPeriod"
                value={searchData.startPeriod}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Bitte wählen...</option>
                {getSchoolPeriods().map(period => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.time})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Bis Periode
              </label>
              <select
                name="endPeriod"
                value={searchData.endPeriod}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Bitte wählen...</option>
                {getSchoolPeriods().map(period => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.time})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={findAvailableRooms}
              className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center font-medium text-lg"
            >
              <Search className="w-5 h-5 mr-2" />
              Verfügbare Räume suchen
            </button>
          </div>
        </div>

        {/* Suchergebnisse */}
        {hasSearched && (
          <div>
            <h3 className="text-xl font-semibold mb-4">
              {availableRooms.length > 0 
                ? `${availableRooms.length} verfügbare Räume gefunden` 
                : 'Keine verfügbaren Räume gefunden'}
            </h3>

            {availableRooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableRooms.map(room => (
                  <div key={room.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">{room.name}</h4>
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        Verfügbar
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      {room.location && (
                        <div className="flex items-center text-gray-600 text-sm">
                          <MapPin className="w-4 h-4 mr-2" />
                          {room.location}
                        </div>
                      )}
                      {room.capacity && (
                        <div className="flex items-center text-gray-600 text-sm">
                          <Users className="w-4 h-4 mr-2" />
                          {room.capacity} Personen
                        </div>
                      )}
                    </div>

                    {room.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {room.description}
                      </p>
                    )}

                    <button
                      onClick={() => handleReserveRoom(room.id)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center font-medium"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Reservieren
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <Search className="w-16 h-16 mx-auto" />
                </div>
                <p className="text-gray-600 text-lg">
                  Leider sind zu der gewünschten Zeit keine Räume verfügbar.
                </p>
                <p className="text-gray-500 mt-2">
                  Versuchen Sie es mit einer anderen Zeit oder einem anderen Datum.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FindAvailableRooms;
