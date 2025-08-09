'use client';

import Link from 'next/link';
import { useRooms } from '../contexts/RoomContext';
// import Button from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

const HomePage = () => {
  const { rooms } = useRooms();

  const SimpleRoomCard = ({ room }) => {
    const loc = room.location || '–';
    const cap = room.capacity ? `${room.capacity} Personen` : '– Personen';
    return (
      <Card
        tabIndex={0}
        role="button"
        aria-label={`Raum ${room.name} öffnen`}
        className="group cursor-pointer flex flex-col h-32 min-h-[8.5rem] select-none transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
        onClick={() => window.location.href = `/room/${room.id}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = `/room/${room.id}`; } }}
      >
        <div className="flex flex-col flex-1">
          <CardHeader className="pb-1 flex-shrink-0">
            <CardTitle className="text-[13px] font-semibold leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
              {room.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-[2px] text-[12px] text-gray-600 overflow-hidden">
            <div className="truncate leading-[1.05]">📍 {loc}</div>
            <div className="truncate leading-[1.05]">👥 {cap}</div>
          </CardContent>
        </div>
      </Card>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-5 space-y-5">
      <div className="space-y-1">
        <h1 className="text-[29px] font-bold tracking-tight text-gray-900 leading-tight">Raumreservierung</h1>
        <p className="text-[12.5px] text-gray-500 leading-tight">Wähle einen Raum für Details und Reservierungen.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {rooms.map(room => <SimpleRoomCard key={room.id} room={room} />)}
      </div>
      <footer className="pt-3 border-t border-gray-100">
        <nav className="flex flex-wrap justify-center gap-2">
          <Link href="/manage-rooms" className="px-3 h-8 inline-flex items-center rounded-md font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-[12px] leading-[1.05]">Räume hinzufügen</Link>
          <Link href="/manage-schedule" className="px-3 h-8 inline-flex items-center rounded-md font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-[12px] leading-[1.05]">Zeiten anpassen</Link>
          <Link href="/find-rooms" className="px-3 h-8 inline-flex items-center rounded-md font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-[12px] leading-[1.05]">Freie Räume finden</Link>
        </nav>
        <div className="mt-2 text-center text-[10px] text-gray-400 tracking-wide uppercase">Version 1.0 · Raumplan</div>
      </footer>
    </div>
  );
};

export default HomePage;
