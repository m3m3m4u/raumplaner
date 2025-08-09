import './globals.css';
import { RoomProvider } from '../contexts/RoomContext';

export const metadata = {
    title: 'Raumplaner',
    description: 'Raum- und Terminverwaltung'
};

export default function RootLayout({ children }) {
    return (
        <html lang="de">
            <body>
                <RoomProvider>
                    {children}
                </RoomProvider>
            </body>
        </html>
    );
}
