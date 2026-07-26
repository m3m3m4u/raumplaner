import './globals.css';
import { RoomProvider } from '../contexts/RoomContext';
import { ToastProvider } from '../contexts/ToastContext';
import Navbar from '../components/layout/Navbar';

export const metadata = {
  title: 'Raumplaner | Schule am See',
  description: 'Moderne Raum- und Terminverwaltung'
};

export default function RootLayout({ children }) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
        <ToastProvider>
          <RoomProvider>
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </RoomProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
