'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit, Trash2, Clock } from 'lucide-react';
import { useRooms } from '../../contexts/RoomContext';

const ManageSchedulePage = () => {
  const { schedule, dispatch } = useRooms();
  const [isHydrated, setIsHydrated] = useState(false);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: ''
  });

  // Hydration-Flag setzen
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startTime || !formData.endTime) {
      alert('Alle Felder sind erforderlich');
      return;
    }
    
    if (editingPeriod) {
      // Stundenzeit bearbeiten
      dispatch({
        type: 'UPDATE_SCHEDULE_PERIOD',
        payload: { 
          id: editingPeriod.id,
          name: formData.name,
          startTime: formData.startTime,
          endTime: formData.endTime
        }
      });
      setEditingPeriod(null);
    } else {
      // Neue Stundenzeit hinzufügen
      dispatch({
        type: 'ADD_SCHEDULE_PERIOD',
        payload: {
          name: formData.name,
          startTime: formData.startTime,
          endTime: formData.endTime
        }
      });
      setShowAddForm(false);
    }
    
    setFormData({ name: '', startTime: '', endTime: '' });
  };

  const handleEdit = (period) => {
    setEditingPeriod(period);
    setFormData({ 
      name: period.name,
      startTime: period.startTime,
      endTime: period.endTime 
    });
    setShowAddForm(true);
  };

  const handleDelete = (period) => {
    if (confirm(`Sind Sie sicher, dass Sie "${period.name}" löschen möchten?`)) {
      dispatch({
        type: 'DELETE_SCHEDULE_PERIOD',
        payload: period.id
      });
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingPeriod(null);
    setFormData({ period: '', startTime: '', endTime: '' });
  };

  const handleSave = () => {
    alert('Stundenzeiten wurden aktualisiert und sind sofort verfügbar!');
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
              ⏰ Stundenzeiten verwalten
            </h1>
          </div>
          <div className="flex gap-3">
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Neue Stunde
              </button>
            )}
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Änderungen speichern
            </button>
          </div>
        </div>

        {/* Formular */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">
              {editingPeriod ? 'Stundenzeit bearbeiten' : 'Neue Stundenzeit hinzufügen'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Name/Bezeichnung
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="z.B. 1. Stunde, Große Pause, Mittagspause"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Startzeit
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Endzeit
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  {editingPeriod ? 'Aktualisieren' : 'Hinzufügen'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stundenzeitenliste */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Aktuelle Stundenzeiten ({isHydrated ? schedule.length : '...'} Stunden)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Definieren Sie hier die Zeiten für jede Schulstunde
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {isHydrated && schedule.map(period => (
              <div key={period.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 text-blue-700 w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm">
                    🕐
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {period.name || `${period.period}. Stunde` || 'Unbenannte Periode'}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {period.startTime} - {period.endTime}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(period)}
                    className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(period)}
                    className="bg-red-100 text-red-700 p-2 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {isHydrated && schedule.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                Noch keine Stundenzeiten definiert. Erstellen Sie die erste Stunde!
              </div>
            )}
            {!isHydrated && (
              <div className="p-6 text-center text-gray-500">
                Lade Stundenzeiten...
              </div>
            )}
          </div>
        </div>

        {/* Info-Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">💡 Hinweis</h3>
          <p className="text-sm text-blue-700">
            Die Stundenzeiten werden für alle Räume verwendet. Änderungen wirken sich auf alle bestehenden und zukünftigen Reservierungen aus.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManageSchedulePage;
