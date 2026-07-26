'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Calendar, Search, Settings, LogOut } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Räume', href: '/', icon: LayoutGrid },
    { label: 'Freie Räume', href: '/find-rooms', icon: Search },
    { label: 'Räume verwalten', href: '/manage-rooms', icon: Settings },
    { label: 'Zeiten anpassen', href: '/manage-schedule', icon: Calendar },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Brand Logo */}
        <Link href="/" className="flex items-baseline gap-1.5 sm:gap-2 flex-shrink-0">
          <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900">
            Raumplaner
          </span>
          <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
            Schule am See
          </span>
        </Link>

        {/* Navigation Tabs (Wrap in new line on narrow screen instead of scroll) */}
        <nav className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Actions / Admin */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => {
              try { sessionStorage.removeItem('adminAuthorized'); } catch (e) {}
              window.location.reload();
            }}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs font-medium"
            title="Abmelden / Reset Admin Session"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </div>
    </header>
  );
}
