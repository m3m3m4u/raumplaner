'use client';

import Link from 'next/link';
import { useRooms } from '../contexts/RoomContext';
import styles from './HomePage.module.css';

const HomePage = () => {
  const { rooms } = useRooms();

  const SimpleRoomCard = ({ room }) => {
    return (
      <div className={`${styles.roomButton} bg-white rounded-xl shadow-lg hover:shadow-xl border border-gray-200 group`}>
        <button
          type="button"
          className="w-full h-full flex flex-col items-center justify-center rounded-xl focus:outline-none group-hover:bg-blue-50 transition-all duration-200"
          onClick={() => window.location.href = `/room/${room.id}`}
        >
          <div className={styles.roomButtonContent}>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-3 group-hover:text-blue-700 transition-colors">{room.name}</h3>
            <div className="flex items-center justify-center text-gray-600 mb-2">
              <span className="text-base">📍 {room.location}</span>
            </div>
            <div className="flex items-center justify-center text-gray-600">
              <span className="text-base">👥 {room.capacity} Personen</span>
            </div>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-green-50 min-h-screen flex flex-col items-center py-8">
      <h1 className={`text-4xl font-bold text-gray-900 ${styles.centeredHeader}`}>Raumreservierung Schule am See</h1>
      <div className={styles.roomGrid6}>
        {rooms.map(room => (
          <SimpleRoomCard key={room.id} room={room} />
        ))}
      </div>
      <footer className={`${styles.centeredFooter} mt-12`}>
        <Link href="/manage-rooms" className="text-blue-700 hover:underline mx-4 font-medium">Räume hinzufügen</Link>
        <span className="text-gray-400">|</span>
        <Link href="/manage-schedule" className="text-blue-700 hover:underline mx-4 font-medium">Zeiten anpassen</Link>
        <span className="text-gray-400">|</span>
        <Link href="/find-rooms" className="text-blue-700 hover:underline mx-4 font-medium">Freie Räume finden</Link>
      </footer>
    </div>
  );
};

export default HomePage;
