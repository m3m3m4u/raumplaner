'use client';

import React, { useEffect } from 'react';
import { Trash2, Calendar, Clock, Layers, X } from 'lucide-react';

export default function DeleteScopeModal({ open, hasSeries, onCancel, onSelect }) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-scope-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-gray-100 p-5 space-y-4 transform transition-all">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 id="delete-scope-title" className="text-base font-semibold text-gray-900">
              Termin löschen
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-600">Bitte wählen Sie den Umfang der Löschung aus:</p>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => onSelect('single')}
            className="w-full flex items-start gap-3 p-3 text-left rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
          >
            <Calendar className="w-4 h-4 text-gray-500 group-hover:text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900 group-hover:text-blue-900">
                Nur diesen Termin
              </div>
              <div className="text-xs text-gray-500">
                Löscht ausschließlich die ausgewählte Einzel-Reservierung.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('time-future')}
            className="w-full flex items-start gap-3 p-3 text-left rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
          >
            <Clock className="w-4 h-4 text-gray-500 group-hover:text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900 group-hover:text-blue-900">
                Zukünftige Termine zur gleichen Zeit
              </div>
              <div className="text-xs text-gray-500">
                Löscht alle kommenden Termine im gleichen Raum mit identischer Uhrzeit.
              </div>
            </div>
          </button>

          {hasSeries && (
            <button
              type="button"
              onClick={() => onSelect('series-all')}
              className="w-full flex items-start gap-3 p-3 text-left rounded-lg border border-gray-200 hover:border-red-500 hover:bg-red-50/50 transition-all group"
            >
              <Layers className="w-4 h-4 text-gray-500 group-hover:text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-900 group-hover:text-red-900">
                  Ganze Serie löschen
                </div>
                <div className="text-xs text-gray-500">
                  Entfernt alle vergangenen und zukünftigen Termine dieser Serie.
                </div>
              </div>
            </button>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
