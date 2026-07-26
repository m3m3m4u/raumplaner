'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRooms } from '../contexts/RoomContext';
import { MapPin, Users, Search, Plus, Calendar, ChevronRight } from 'lucide-react';
import { Card } from './ui/Card';

export default function HomePage() {
  const { rooms, reservations } = useRooms();
  const [searchTerm, setSearchTerm] = useState('');

  // Berechne belegte Räume aktuell
  const currentlyOccupiedRoomIds = useMemo(() => {
    const now = new Date();
    return reservations
      .filter((res) => {
        try {
          const start = new Date(res.startTime);
          const end = new Date(res.endTime);
          return start <= now && end > now;
        } catch (_) {
          return false;
        }
      })
      .map((r) => r.roomId);
  }, [reservations]);

  const sortedRooms = useMemo(() => {
    return [...rooms]
      .filter((room) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        const nameMatch = (room.name || '').toLowerCase().includes(q);
        const locMatch = (room.location || '').toLowerCase().includes(q);
        const eqMatch = Array.isArray(room.equipment) && room.equipment.some((e) => e.toLowerCase().includes(q));
        return nameMatch || locMatch || eqMatch;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de', { sensitivity: 'base' }));
  }, [rooms, searchTerm]);

  const RoomCard = ({ room }) => {
    const isOccupied = currentlyOccupiedRoomIds.includes(room.id);
    const loc = room.location || 'Hauptgebäude';
    const cap = room.capacity ? `${room.capacity} Personen` : '–';

    return (
      <Card
        tabIndex={0}
        role="button"
        aria-label={`Raum ${room.name} öffnen`}
        className="group cursor-pointer flex flex-col justify-between h-32 select-none bg-white border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all p-3.5"
        onClick={() => (window.location.href = `/room/${room.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.location.href = `/room/${room.id}`;
          }
        }}
      >
        <div className="space-y-1.5">
          {/* Status & Name */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 text-sm group-hover:text-slate-700 transition-colors line-clamp-1">
              {room.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 border ${
                isOccupied
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-slate-500' : 'bg-emerald-500'}`} />
              {isOccupied ? 'Belegt' : 'Frei'}
            </span>
          </div>

          {/* Location & Capacity */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span className="truncate max-w-[100px]">{loc}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              <span>{cap}</span>
            </span>
          </div>
        </div>

        {/* Equipment & Arrow */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="truncate">
            {Array.isArray(room.equipment) && room.equipment.length > 0
              ? room.equipment.slice(0, 2).join(', ') + (room.equipment.length > 2 ? ' ...' : '')
              : 'Keine Angaben'}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors flex-shrink-0" />
        </div>
      </Card>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Compact Neutral Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Raumreservierung</h1>
            <p className="text-xs text-slate-500">Wähle einen Raum für Details und Belegungspläne.</p>
          </div>

          {/* Search and Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Raum suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <Link
              href="/find-rooms"
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex-shrink-0"
            >
              Freie Räume
            </Link>
            <Link
              href="/manage-rooms"
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors flex items-center gap-1 flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Raum</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Room Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>Räume ({sortedRooms.length})</span>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-700 hover:underline">
              Filter zurücksetzen
            </button>
          )}
        </div>

        {sortedRooms.length > 0 ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sortedRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500 space-y-2">
            <div>Keine Räume für &quot;{searchTerm}&quot; gefunden.</div>
            <button onClick={() => setSearchTerm('')} className="text-slate-900 font-medium hover:underline">
              Filter aufheben
            </button>
          </div>
        )}
      </div>

      {/* Subtle Footer */}
      <footer className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-3">
          <Link href="/manage-rooms" className="hover:text-slate-700 transition-colors">
            Räume verwalten
          </Link>
          <span>·</span>
          <Link href="/manage-schedule" className="hover:text-slate-700 transition-colors">
            Zeiten anpassen
          </Link>
          <span>·</span>
          <Link href="/find-rooms" className="hover:text-slate-700 transition-colors">
            Freie Räume finden
          </Link>
        </div>
        <div>Raumplaner · Schule am See</div>
      </footer>
    </div>
  );
}
