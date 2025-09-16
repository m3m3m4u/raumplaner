'use client';

import { useState } from 'react';
import { getLocalDateTime } from '../lib/roomData';
import { useRooms } from '../contexts/RoomContext';
import { MapPin, Users, Monitor, Search, Filter, ArrowLeft } from 'lucide-react';

const RoomsOverviewPage = () => {
  const { rooms, reservations } = useRooms();
  const roomsSorted = [...rooms].sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'de', { sensitivity: 'base' }));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCapacity, setFilterCapacity] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  // Filter-Logik
  const filteredRooms = roomsSorted.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCapacity = filterCapacity === '' || 
                           (filterCapacity === 'small' && room.capacity <= 6) ||
                           (filterCapacity === 'medium' && room.capacity > 6 && room.capacity <= 15) ||
                           (filterCapacity === 'large' && room.capacity > 15);
    
    const matchesLocation = filterLocation === '' || room.location === filterLocation;
    
    return matchesSearch && matchesCapacity && matchesLocation;
  });

  // Einzigartige Standorte für Filter
  const uniqueLocations = [...new Set(roomsSorted.map(room => room.location))];

  const getRoomStatus = (roomId) => {
    const now = new Date();
    const currentReservation = reservations.find(res => {
      const start = getLocalDateTime(res, 'start') || new Date(res.startTime);
      const end = getLocalDateTime(res, 'end') || new Date(res.endTime);
      return res.roomId === roomId && start <= now && end > now;
    });
    
    return currentReservation ? 'belegt' : 'frei';
  };

  const RoomListItem = ({ room }) => {
    const status = getRoomStatus(room.id);
    const isOccupied = status === 'belegt';

    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{room.name}</h3>
              <p className="text-gray-600 text-sm mb-3">{room.description}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isOccupied 
                ? 'bg-red-100 text-red-700' 
                : 'bg-green-100 text-green-700'
            }`}>
              {isOccupied ? 'Belegt' : 'Verfügbar'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center text-gray-600">
              <MapPin className="w-4 h-4 mr-2 text-gray-400" />
              <span className="text-sm">{room.location}</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <Users className="w-4 h-4 mr-2 text-gray-400" />
              <span className="text-sm">{room.capacity} Personen</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <Monitor className="w-4 h-4 mr-2 text-gray-400" />
              <span className="text-sm">{room.equipment.length} Geräte</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {room.equipment.map(equipment => (
              <span key={equipment} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs">
                {equipment}
              </span>
            ))}
          </div>

          <a
            href={`/room/${room.id}`}
            className="block w-full bg-blue-600 text-white text-center py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Raum ansehen
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Raumverwaltung</h1>
              <p className="text-gray-600 mt-1">
                {filteredRooms.length} von {rooms.length} Räumen verfügbar
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('de-DE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Such- und Filter-Bereich */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Suchfeld */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="inline w-4 h-4 mr-1" />
                Suchen
              </label>
              <input
                type="text"
                placeholder="Raumname oder Beschreibung..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Kapazitäts-Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="inline w-4 h-4 mr-1" />
                Kapazität
              </label>
              <select
                value={filterCapacity}
                onChange={(e) => setFilterCapacity(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Alle Größen</option>
                <option value="small">Klein (bis 6 Personen)</option>
                <option value="medium">Mittel (7-15 Personen)</option>
                <option value="large">Groß (16+ Personen)</option>
              </select>
            </div>

            {/* Standort-Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                Standort
              </label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Alle Standorte</option>
                {uniqueLocations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset Filter Button */}
          {(searchTerm || filterCapacity || filterLocation) && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterCapacity('');
                  setFilterLocation('');
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Filter zurücksetzen
              </button>
            </div>
          )}
        </div>

        {/* Raumliste */}
        {filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Räume gefunden</h3>
            <p className="text-gray-600">
              Versuchen Sie es mit anderen Suchbegriffen oder Filtern.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredRooms.map(room => (
              <RoomListItem key={room.id} room={room} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default RoomsOverviewPage;
