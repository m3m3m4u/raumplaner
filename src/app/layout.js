import { Inter } from "next/font/google";
import "./globals.css";
import { RoomProvider } from '../contexts/RoomContext';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Raumverwaltung",
  description: "Tool zur Verwaltung von Räumen und Reservierungen",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <RoomProvider>
          {children}
        </RoomProvider>
      </body>
    </html>
  );
}
