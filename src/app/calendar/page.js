import CalendarView from '../../components/CalendarView';
import { ArrowLeft } from 'lucide-react';

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <a href="/" className="mr-4 p-2 hover:bg-gray-100 rounded-md">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </a>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Kalenderansicht</h1>
                <p className="text-gray-600 mt-1">Übersicht aller Reservierungen</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CalendarView />
      </main>
    </div>
  );
}
