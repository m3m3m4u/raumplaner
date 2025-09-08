'use client';

import { useState } from 'react';
import { useRooms } from '../contexts/RoomContext';
import { MapPin, Users, Settings, Monitor, Calendar, Edit, Trash2 } from 'lucide-react';
import ReservationForm from './ReservationForm';
import { getReservationsForRoom } from '../lib/roomData';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const RoomCard = ({ room }) => {
  const { reservations, dispatch } = useRooms();
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  const roomReservations = getReservationsForRoom(reservations, room.id);
  const nextReservation = roomReservations.find(res => new Date(res.startTime) > new Date());

  const handleDeleteReservation = (reservationId) => {
    if (confirm('Sind Sie sicher, dass Sie diese Reservierung löschen möchten?')) {
      dispatch({
        type: 'DELETE_RESERVATION',
        payload: reservationId
      });
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold text-gray-800">{room.name}</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="p-2 text-gray-500 hover:text-gray-700"
                title="Details anzeigen"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center text-gray-600">
              <MapPin className="w-4 h-4 mr-2" />
              <span className="text-sm">{room.location}</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <Users className="w-4 h-4 mr-2" />
              <span className="text-sm">Bis zu {room.capacity} Personen</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <Monitor className="w-4 h-4 mr-2" />
              <span className="text-sm">{room.equipment.join(', ')}</span>
            </div>
          </div>

          {room.description && (
            <p className="text-gray-600 text-sm mb-4">{room.description}</p>
          )}

          {nextReservation && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <h4 className="font-medium text-blue-800 mb-1">Nächste Reservierung:</h4>
              <p className="text-sm text-blue-700">{nextReservation.title}</p>
              <p className="text-xs text-blue-600">
                {format(new Date(nextReservation.startTime), 'dd.MM.yyyy HH:mm', { locale: de })} - 
                {format(new Date(nextReservation.endTime), 'HH:mm', { locale: de })}
              </p>
            </div>
          )}

          <button
            onClick={() => setShowReservationForm(true)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Reservieren
          </button>
        </div>

        {showDetails && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <h4 className="font-medium mb-3">Aktuelle Reservierungen:</h4>
            {roomReservations.length === 0 ? (
              <p className="text-gray-500 text-sm">Keine Reservierungen vorhanden</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {roomReservations.map(reservation => (
                  <div key={reservation.id} className="bg-white p-3 rounded border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-medium text-sm">{reservation.title}</h5>
                        <p className="text-xs text-gray-600 mb-1">
                          {format(new Date(reservation.startTime), 'dd.MM.yyyy HH:mm', { locale: de })} - 
                          {format(new Date(reservation.endTime), 'HH:mm', { locale: de })}
                        </p>
                        <p className="text-xs text-gray-500">
                          Organisator: {reservation.organizer}
                          {reservation.attendees && ` • ${reservation.attendees} Teilnehmer`}
                        </p>
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <button
                          onClick={() => console.log('Edit reservation', reservation.id)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Bearbeiten"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteReservation(reservation.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Löschen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showReservationForm && (
        <ReservationForm
          selectedRoom={room}
          onClose={() => setShowReservationForm(false)}
        />
      )}
    </>
  );
};

const RoomGrid = () => {
  const { rooms } = useRooms();
  const sorted = [...rooms].sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'de', { sensitivity: 'base' }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {sorted.map(room => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  );
};

export default RoomGrid;
