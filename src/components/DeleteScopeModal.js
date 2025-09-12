'use client';

import React from 'react';

export default function DeleteScopeModal({ open, hasSeries, onCancel, onSelect }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-lg shadow-xl border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Termin löschen</h3>
        <p className="text-sm text-gray-600 mb-4">Was möchten Sie löschen?</p>
        <div className="space-y-2">
          <button
            onClick={() => onSelect('single')}
            className="w-full text-left px-4 py-2 rounded border border-gray-300 hover:border-blue-400 hover:bg-blue-50"
          >
            Nur diesen Termin
          </button>
          <button
            onClick={() => onSelect('time-future')}
            className="w-full text-left px-4 py-2 rounded border border-gray-300 hover:border-blue-400 hover:bg-blue-50"
          >
            Alle zukünftigen Termine mit gleicher Uhrzeit in diesem Raum
          </button>
          {hasSeries && (
            <button
              onClick={() => onSelect('series-all')}
              className="w-full text-left px-4 py-2 rounded border border-gray-300 hover:border-blue-400 hover:bg-blue-50"
            >
              Ganze Serie
            </button>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
