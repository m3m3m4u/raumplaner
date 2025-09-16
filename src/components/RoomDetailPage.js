'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRooms } from '../contexts/RoomContext';
import { MapPin, Users, Monitor, Calendar, Clock, Edit, Trash2, ArrowLeft, Plus } from 'lucide-react';
import { getReservationsForRoom, getLocalDateTime } from '../lib/roomData';
import { format, isToday, isTomorrow, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import ReservationForm from './ReservationForm';

const RoomDetailPage = ({ roomId }) => {
  const { rooms, reservations, dispatch } = useRooms();
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [editReservation, setEditReservation] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const room = rooms.find(r => r.id === parseInt(roomId));
  
  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Raum nicht gefunden</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    );
  }

  const roomReservations = getReservationsForRoom(reservations, room.id);
  
  const filteredReservations = roomReservations.filter(res => {
    const resDate = getLocalDateTime(res, 'start') || new Date(res.startTime);
    return resDate.toDateString() === selectedDate.toDateString();
  });

  const upcomingReservations = roomReservations.filter(res => 
    (getLocalDateTime(res, 'start') || new Date(res.startTime)) > new Date()
  ).slice(0, 5);

  const currentReservation = roomReservations.find(res => {
    const now = new Date();
    const start = getLocalDateTime(res, 'start') || new Date(res.startTime);
    const end = getLocalDateTime(res, 'end') || new Date(res.endTime);
    return start <= now && end > now;
  });

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

  const formatDateLabel = (date) => {
    if (isToday(date)) return 'Heute';
    if (isTomorrow(date)) return 'Morgen';
    if (isYesterday(date)) return 'Gestern';
    return format(date, 'EEEE, dd.MM.yyyy', { locale: de });
  };

  const getStatusColor = () => {
    if (currentReservation) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="mr-4 p-2 hover:bg-gray-100 rounded-md">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{room.name}</h1>
                <p className="text-gray-600 mt-1">{room.description}</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowReservationForm(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Reservieren
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Raum-Informationen */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Raum-Details</h2>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <MapPin className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Standort</p>
                    <p className="font-medium">{room.location}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Users className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Kapazität</p>
                    <p className="font-medium">Bis zu {room.capacity} Personen</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Monitor className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Ausstattung</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {room.equipment.map(item => (
                        <span key={item} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Aktueller Status */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Aktueller Status</h2>
              
              <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {currentReservation ? 'Belegt' : 'Verfügbar'}
                  </span>
                  <Clock className="w-5 h-5" />
                </div>
                
                {currentReservation && (
                  <div className="mt-2">
                    <p className="font-medium text-sm">{currentReservation.title}</p>
                    <p className="text-sm opacity-75">
                      bis {format(getLocalDateTime(currentReservation, 'end') || new Date(currentReservation.endTime), 'HH:mm', { locale: de })}
                    </p>
                    <p className="text-sm opacity-75">
                      Organisator: {currentReservation.organizer}
                    </p>
                  </div>
                )}
              </div>

              {upcomingReservations.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium text-sm text-gray-700 mb-2">Nächste Reservierungen:</h3>
                  <div className="space-y-2">
                    {upcomingReservations.map(res => (
                      <div key={res.id} className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                        <p className="font-medium">{res.title}</p>
                        <p>{format(getLocalDateTime(res, 'start') || new Date(res.startTime), 'dd.MM. HH:mm', { locale: de })} - {format(getLocalDateTime(res, 'end') || new Date(res.endTime), 'HH:mm', { locale: de })}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reservierungen für ausgewähltes Datum */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Reservierungen</h2>
                  <input
                    type="date"
                    value={selectedDate.toISOString().split('T')[0]}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <p className="text-gray-600 mt-1">
                  {formatDateLabel(selectedDate)} • {filteredReservations.length} Reservierung(en)
                </p>
              </div>

              <div className="p-6">
                {filteredReservations.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Keine Reservierungen für diesen Tag</p>
                    <button
                      onClick={() => setShowReservationForm(true)}
                      className="mt-4 text-blue-600 hover:text-blue-800"
                    >
                      Neue Reservierung erstellen
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredReservations
                      .sort((a, b) => {
                        const as = getLocalDateTime(a, 'start') || new Date(a.startTime);
                        const bs = getLocalDateTime(b, 'start') || new Date(b.startTime);
                        return as - bs;
                      })
                      .map(reservation => (
                        <div key={reservation.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-gray-900">
                                {reservation.title}
                              </h3>
                              
                              <div className="flex items-center text-gray-600 mt-2">
                                <Clock className="w-4 h-4 mr-2" />
                                <span>
                                  {format(getLocalDateTime(reservation, 'start') || new Date(reservation.startTime), 'HH:mm', { locale: de })} - 
                                  {format(getLocalDateTime(reservation, 'end') || new Date(reservation.endTime), 'HH:mm', { locale: de })}
                                </span>
                              </div>
                              
                              <div className="flex items-center text-gray-600 mt-1">
                                <Users className="w-4 h-4 mr-2" />
                                <span>
                                  {reservation.organizer}
                                  {reservation.attendees && ` • ${reservation.attendees} Teilnehmer`}
                                </span>
                              </div>
                              
                              {reservation.description && (
                                <p className="text-gray-600 mt-2 text-sm">
                                  {reservation.description}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex space-x-2 ml-4">
                              <button
                                onClick={() => handleEditReservation(reservation)}
                                className="p-2 text-gray-400 hover:text-blue-600"
                                title="Bearbeiten"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteReservation(reservation.id)}
                                className="p-2 text-gray-400 hover:text-red-600"
                                title="Löschen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reservation Form Modal */}
      {showReservationForm && (
        <ReservationForm
          selectedRoom={room}
          editReservation={editReservation}
          onClose={() => {
            setShowReservationForm(false);
            setEditReservation(null);
          }}
        />
      )}
    </div>
  );
};

export default RoomDetailPage;
