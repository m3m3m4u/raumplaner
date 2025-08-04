'use client';

import { useRooms } from '../contexts/RoomContext';

const MinimalHomePage = () => {
  const { rooms } = useRooms();

  // Sicherheitsabfrage: Stelle sicher, dass rooms ein Array ist
  const roomsList = Array.isArray(rooms) ? rooms : [];

  console.log('MinimalHomePage - rooms:', rooms, 'Array?', Array.isArray(rooms)); // Debug

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🏢 Schulraumverwaltung
            </h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              Verwalten Sie Räume und Reservierungen einfach und übersichtlich
            </p>
          </div>
        </div>
      </div>

      {/* Hauptinhalt */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        
        {/* Verwaltungsbuttons */}
        <div className="mb-20">
          <h2 className="text-2xl font-semibold text-gray-800 text-center mb-8">
            Verwaltung
          </h2>
          <div className="flex flex-col md:flex-row justify-center gap-8 max-w-4xl mx-auto">
            <a
              href="/manage-rooms"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-8 text-center transition-colors shadow-md hover:shadow-lg"
            >
              <div className="text-4xl mb-4">🏫</div>
              <h3 className="text-xl font-semibold mb-2">Räume verwalten</h3>
              <p className="text-blue-100">
                Räume hinzufügen, bearbeiten oder löschen
              </p>
            </a>
            
            <a
              href="/manage-schedule"
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-8 text-center transition-colors shadow-md hover:shadow-lg"
            >
              <div className="text-4xl mb-4">⏰</div>
              <h3 className="text-xl font-semibold mb-2">Stundenzeiten verwalten</h3>
              <p className="text-green-100">
                Schulstunden und Zeitpläne konfigurieren
              </p>
            </a>
          </div>
        </div>
        
        {/* Raumübersicht */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-gray-800 text-center mb-12">
            Verfügbare Räume
          </h2>
          
          {roomsList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {roomsList.map(room => (
                <a
                  key={room.id}
                  href={`/room/${room.id}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-8 text-center border border-gray-200 hover:border-blue-300"
                >
                  <div className="text-5xl mb-6">🚪</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">
                    {room.name}
                  </h3>
                  <p className="text-gray-500">
                    Klicken zum Öffnen
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 max-w-md mx-auto">
              <div className="text-6xl mb-8">🏫</div>
              <h3 className="text-2xl font-semibold text-gray-700 mb-4">
                Keine Räume gefunden
              </h3>
              <p className="text-gray-500 mb-8 text-lg">
                Beginnen Sie mit der Verwaltung, indem Sie Ihren ersten Raum hinzufügen.
              </p>
              <a
                href="/manage-rooms"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg transition-colors font-medium text-lg"
              >
                ➕ Ersten Raum hinzufügen
              </a>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-gray-100 border-t py-12 mt-20">
        <div className="max-w-6xl mx-auto px-8 text-center">
          <p className="text-gray-600">
            Schulraumverwaltung • Entwickelt für effiziente Raumplanung
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MinimalHomePage;
