'use client';

import { useState } from 'react';
import { Calendar, MapPin, Plus, Settings } from 'lucide-react';
import RoomGrid from '../components/RoomGrid';
import CalendarView from '../components/CalendarView';
import ReservationForm from '../components/ReservationForm';

const Navigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'rooms', label: 'Räume', icon: MapPin },
    { id: 'calendar', label: 'Kalender', icon: Calendar },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex">
            <div className="flex space-x-8">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setActiveTab('newReservation')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center text-sm font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Neue Reservierung
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('rooms');

  const renderContent = () => {
    switch (activeTab) {
      case 'rooms':
        return (
          <div>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Raumübersicht</h1>
              <p className="text-gray-600 mt-2">Verfügbare Räume und deren aktuelle Reservierungen</p>
            </div>
            <RoomGrid />
          </div>
        );
      
      case 'calendar':
        return (
          <div>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Kalenderansicht</h1>
              <p className="text-gray-600 mt-2">Übersicht aller Reservierungen</p>
            </div>
            <CalendarView />
          </div>
        );
      
      case 'newReservation':
        return (
          <ReservationForm
            onClose={() => setActiveTab('rooms')}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Settings className="w-8 h-8 mr-3 text-blue-600" />
                Raumverwaltung
              </h1>
              <p className="text-gray-600 mt-1">Verwalten Sie Räume und Reservierungen</p>
            </div>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('de-DE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </header>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;
