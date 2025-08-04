'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRooms } from '../../contexts/RoomContext';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const FindRoomsPage = () => {
  const { rooms, reservations, schedule } = useRooms();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startPeriod, setStartPeriod] = useState('');
  const [endPeriod, setEndPeriod] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Debug: Zeige den Status der geladenen Daten
  console.log('FindRoomsPage - Geladene Daten:', {
    rooms: rooms?.length || 0,
    reservations: reservations?.length || 0,
    schedule: schedule?.length || 0
  });
  
  console.log('FindRoomsPage - Schedule Details:', schedule);

  // Zeige auch an, wenn Schedule leer ist
  if (!schedule || schedule.length === 0) {
    console.warn('WARNUNG: Schedule ist leer oder nicht geladen!');
  }

  const findAvailableRooms = () => {
    console.log('Debug: Eingaben:', { selectedDate, startPeriod, endPeriod });
    console.log('Debug: Schedule:', schedule);
    console.log('Debug: Rooms:', rooms);
    console.log('Debug: Reservations:', reservations);

    if (!selectedDate || !startPeriod || !endPeriod) {
      alert('Bitte wählen Sie ein Datum, Start- und Endzeit aus.');
      return;
    }

    // Konvertiere die Period-IDs zu Numbers, falls sie als Strings kommen
    const startPeriodId = typeof startPeriod === 'string' ? parseInt(startPeriod) : startPeriod;
    const endPeriodId = typeof endPeriod === 'string' ? parseInt(endPeriod) : endPeriod;
    
    console.log('Debug: Konvertierte IDs:', { startPeriodId, endPeriodId });

    const startPeriodData = schedule.find(p => p.id === startPeriodId);
    const endPeriodData = schedule.find(p => p.id === endPeriodId);
    
    console.log('Debug: Start Period Data:', startPeriodData);
    console.log('Debug: End Period Data:', endPeriodData);
    
    if (!startPeriodData || !endPeriodData) {
      alert(`Ungültige Periode ausgewählt. Start: ${startPeriodData ? 'OK' : 'Fehlt'}, Ende: ${endPeriodData ? 'OK' : 'Fehlt'}`);
      return;
    }

    // Prüfe, ob Start vor Ende liegt (gleich ist auch erlaubt für eine einzelne Periode)
    const startIndex = schedule.findIndex(p => p.id === startPeriodId);
    const endIndex = schedule.findIndex(p => p.id === endPeriodId);
    
    if (startIndex > endIndex) {
      alert('Die Startzeit muss vor oder gleich der Endzeit liegen.');
      return;
    }

    // Erstelle Start- und Endzeit für den gewählten Zeitraum
    const startTime = new Date(`${selectedDate}T${startPeriodData.startTime}`);
    const endTime = new Date(`${selectedDate}T${endPeriodData.endTime}`);

    console.log('Debug: Zeitraum:', { startTime, endTime });

    const availableRooms = rooms.filter(room => {
      // Prüfe, ob der Raum in diesem Zeitraum bereits reserviert ist
      const isConflicting = reservations.some(reservation => {
        if (reservation.roomId !== room.id) return false;
        
        const resStart = new Date(reservation.startTime);
        const resEnd = new Date(reservation.endTime);
        
        // Prüfe auf Überschneidung
        return (startTime < resEnd && endTime > resStart);
      });
      
      return !isConflicting;
    });

    console.log('Debug: Verfügbare Räume:', availableRooms);
    setSearchResults(availableRooms);
    setHasSearched(true);
  };

  const formatDateForDisplay = (dateStr) => {
    return format(parseISO(dateStr), 'EEEE, dd.MM.yyyy', { locale: de });
  };

  const getReservationUrl = (roomId) => {
    const startPeriodId = typeof startPeriod === 'string' ? parseInt(startPeriod) : startPeriod;
    const endPeriodId = typeof endPeriod === 'string' ? parseInt(endPeriod) : endPeriod;
    
    const params = new URLSearchParams({
      roomId,
      date: selectedDate,
      startPeriod: startPeriodId,
      endPeriod: endPeriodId
    });
    return `/reservation?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Freie Räume finden
          </h1>
          <p className="text-lg text-gray-600">
            Suchen Sie nach verfügbaren Räumen für einen bestimmten Zeitraum
          </p>
        </div>

        {/* Navigation zurück */}
        <div className="mb-6">
          <Link 
            href="/" 
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
          >
            ← Zurück zur Startseite
          </Link>
        </div>

        {/* Such-Formular */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Suchkriterien
          </h2>
          
          {!schedule || schedule.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Lade Zeiten...</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-6">
                {/* Datum */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Datum
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={format(addDays(new Date(), 365), 'yyyy-MM-dd')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Startzeit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Von (Startzeit)
                  </label>
                  <select
                    value={startPeriod}
                    onChange={(e) => setStartPeriod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    {schedule.map(period => (
                      <option key={period.id} value={period.id}>
                        {period.name} ({period.startTime} - {period.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Endzeit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bis (Endzeit)
                  </label>
                  <select
                    value={endPeriod}
                    onChange={(e) => setEndPeriod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    {schedule.map(period => (
                      <option key={period.id} value={period.id}>
                        {period.name} ({period.startTime} - {period.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Such-Button */}
              <div className="mt-6">
                <button
                  onClick={findAvailableRooms}
                  className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  🔍 Freie Räume suchen
                </button>
              </div>
            </>
          )}
        </div>

        {/* Suchergebnisse */}
        {hasSearched && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Suchergebnisse
            </h2>
            
            {selectedDate && startPeriod && endPeriod && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Gesucht:</strong> {formatDateForDisplay(selectedDate)} - {
                    schedule.find(p => p.id === (typeof startPeriod === 'string' ? parseInt(startPeriod) : startPeriod))?.name || 'Unbekannte Zeit'
                  } bis {
                    schedule.find(p => p.id === (typeof endPeriod === 'string' ? parseInt(endPeriod) : endPeriod))?.name || 'Unbekannte Zeit'
                  }
                </p>
              </div>
            )}

            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg">
                  😔 Keine freien Räume gefunden
                </p>
                <p className="text-gray-400 mt-2">
                  Versuchen Sie es mit einem anderen Datum oder einer anderen Zeit.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map(room => (
                  <div 
                    key={room.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {room.name}
                    </h3>
                    <div className="text-sm text-gray-600 mb-3 space-y-1">
                      <div className="flex items-center">
                        <span>📍 {room.location}</span>
                      </div>
                      <div className="flex items-center">
                        <span>👥 {room.capacity} Personen</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/room/${room.id}`}
                        className="flex-1 text-center px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                      >
                        Details
                      </a>
                      <a
                        href={getReservationUrl(room.id)}
                        className="flex-1 text-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                      >
                        Reservieren
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FindRoomsPage;
