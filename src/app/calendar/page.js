import CalendarView from '../../components/CalendarView';

export const metadata = {
	title: 'Kalender – Nur Anzeige',
	description: 'Read-Only Ansicht der Raumpläne'
};

export default function PublicCalendarPage() {
	return (
		<div className="min-h-screen bg-gray-50 py-8">
			<div className="max-w-6xl mx-auto px-4">
				<header className="mb-6 text-center">
					<h1 className="text-3xl font-semibold text-gray-900">Raumpläne</h1>
					<p className="text-sm text-gray-500 mt-2">
						Diese Ansicht ist nur zum Anschauen gedacht – Änderungen sind hier nicht möglich.
					</p>
				</header>

				<CalendarView readOnly />

				<p className="mt-6 text-xs text-gray-400 text-center">
					Bereitgestellt als externer Link zur reinen Ansicht der aktuellen Raumbelegung.
				</p>
			</div>
		</div>
	);
}
