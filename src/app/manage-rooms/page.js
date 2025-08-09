'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRooms } from '../../contexts/RoomContext';
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';

const ManageRoomsPage = () => {
  const { rooms, dispatch } = useRooms();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    equipment: [],
    capacity: '',
    location: ''
  });
  const [equipmentInput, setEquipmentInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Räume von der API laden
  const loadRooms = useCallback(async () => {
    try {
      const response = await fetch('/api/rooms');
      if (response.ok) {
        const apiRooms = await response.json();
        console.log('ManageRooms: API-Räume:', apiRooms); // Debug
        
        // Context mit API-Daten synchronisieren
        if (Array.isArray(apiRooms)) {
          dispatch({
            type: 'SET_ROOMS',
            payload: apiRooms
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Räume:', error);
    }
  }, [dispatch]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Raumname ist erforderlich');
      return;
    }

    setLoading(true);

    try {
      if (editingRoom) {
        // Raum bearbeiten
        const response = await fetch('/api/rooms', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: editingRoom.id, 
            name: formData.name,
            description: formData.description,
            equipment: formData.equipment,
            capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
            location: formData.location?.trim() || ''
          })
        });

        if (response.ok) {
          const updatedRoom = await response.json();
          dispatch({
            type: 'UPDATE_ROOM',
            payload: updatedRoom
          });
          setEditingRoom(null);
        } else {
          const error = await response.json();
          alert('Fehler beim Aktualisieren: ' + error.error);
        }
      } else {
        // Neuen Raum hinzufügen
        const response = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: formData.name,
            description: formData.description,
            equipment: formData.equipment,
            capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
            location: formData.location?.trim() || ''
          })
        });

        if (response.ok) {
          const newRoom = await response.json();
          dispatch({
            type: 'ADD_ROOM',
            payload: newRoom
          });
          setShowAddForm(false);
        } else {
          const error = await response.json();
          alert('Fehler beim Erstellen: ' + error.error);
        }
      }
      
  setFormData({ name: '', description: '', equipment: [], capacity: '', location: '' });
      setEquipmentInput('');
    } catch (error) {
      console.error('API-Fehler:', error);
      alert('Netzwerkfehler. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({ 
      name: room.name || '', 
      description: room.description || '', 
      equipment: room.equipment || [],
      capacity: room.capacity || '',
      location: room.location || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (room) => {
    if (confirm(`Sind Sie sicher, dass Sie "${room.name}" löschen möchten? Alle Reservierungen für diesen Raum werden ebenfalls gelöscht.`)) {
      setLoading(true);
      
      try {
        const response = await fetch(`/api/rooms?id=${room.id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          // Erfolgreich gelöscht
          dispatch({
            type: 'DELETE_ROOM',
            payload: room.id
          });
          
          // Optional: Bestätigungsnachricht anzeigen
          const result = await response.json();
          console.log('Raum gelöscht:', result.message);
        } else {
          // Fehler beim Löschen
          try {
            const error = await response.json();
            alert('Fehler beim Löschen: ' + (error.error || 'Unbekannter Fehler'));
          } catch (jsonError) {
            // Falls die Antwort kein gültiges JSON ist
            alert('Fehler beim Löschen: Server-Antwort konnte nicht verarbeitet werden');
          }
        }
      } catch (error) {
        console.error('API-Fehler:', error);
        alert('Netzwerkfehler. Bitte versuchen Sie es erneut.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingRoom(null);
  setFormData({ name: '', description: '', equipment: [], capacity: '', location: '' });
    setEquipmentInput('');
  };

  const addEquipment = () => {
    if (equipmentInput.trim() && !formData.equipment.includes(equipmentInput.trim())) {
      setFormData(prev => ({
        ...prev,
        equipment: [...prev.equipment, equipmentInput.trim()]
      }));
      setEquipmentInput('');
    }
  };

  const removeEquipment = (item) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.filter(eq => eq !== item)
    }));
  };

  const handleFormDataChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Zurück zur Startseite
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              🏫 Räume verwalten
            </h1>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neuer Raum
            </button>
          )}
        </div>

        {/* Formular */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 space-y-6">
            <h2 className="text-xl font-bold mb-4">
              {editingRoom ? 'Raum bearbeiten' : 'Neuen Raum hinzufügen'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Raumname *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormDataChange('name', e.target.value)}
                  placeholder="z.B. Klassenzimmer A101"
                    className="w-full p-3 border border-gray-300 rounded-md text-sm"
                  autoFocus
                  required
                />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Kapazität (Personen)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.capacity}
                      onChange={(e) => handleFormDataChange('capacity', e.target.value)}
                      placeholder="z.B. 30"
                      className="w-full p-3 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Lage</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => handleFormDataChange('location', e.target.value)}
                      placeholder="z.B. 1. Stock"
                      className="w-full p-3 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Beschreibung
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFormDataChange('description', e.target.value)}
                  placeholder="Optionale Beschreibung des Raums..."
                  rows={3}
                    className="w-full p-3 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Ausstattung
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={equipmentInput}
                    onChange={(e) => setEquipmentInput(e.target.value)}
                    placeholder="z.B. Beamer, Whiteboard..."
            className="flex-1 p-3 border border-gray-300 rounded-md text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEquipment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addEquipment}
            className="h-10 px-4 inline-flex items-center justify-center rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    +
                  </button>
                </div>
                
                {formData.equipment.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.equipment.map((item, index) => (
                      <span 
                        key={index}
                          className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1.5"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeEquipment(item)}
                            className="text-red-500 hover:text-red-700 font-bold leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
            className="h-10 px-6 inline-flex items-center justify-center rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Speichert...' : (editingRoom ? 'Aktualisieren' : 'Hinzufügen')}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
            className="h-10 px-6 inline-flex items-center justify-center rounded-md bg-gray-500 text-white text-sm font-medium hover:bg-gray-600"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Raumliste */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Vorhandene Räume ({rooms.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {rooms.map(room => (
              <div key={room.id} className="p-5 flex items-start justify-between gap-6 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{room.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">ID {room.id}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                      {room.location && <span>📍 {room.location}</span>}
                      {room.capacity && <span>👥 {room.capacity} Pers.</span>}
                    </div>
                    {room.equipment && room.equipment.length > 0 && (
                      <div className="text-[11px] text-gray-500 line-clamp-1">{room.equipment.join(', ')}</div>
                    )}
                    {room.description && (
                      <div className="text-[11px] text-gray-400 line-clamp-2 italic">{room.description}</div>
                    )}
                  </div>
                <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleEdit(room)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                      title="Bearbeiten"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                </div>
              </div>
            ))}
            {rooms.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                Noch keine Räume vorhanden. Erstellen Sie den ersten Raum!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageRoomsPage;
