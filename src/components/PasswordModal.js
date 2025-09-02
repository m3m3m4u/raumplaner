'use client';

import { useState, useEffect } from 'react';

export default function PasswordModal({ open, title = 'Passwort eingeben', message, onSubmit, onCancel, submitLabel = 'Bestätigen', error }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) {
      setValue('');
      // Fokus nach Render setzen
      setTimeout(() => {
        const el = document.getElementById('password-modal-input');
        if (el) el.focus();
      }, 30);
    }
  }, [open]);

  if (!open) return null;

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onKeyDown={handleKey}>
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl border border-gray-200 animate-fade-in">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm">
          {message && <p className="text-gray-700 leading-relaxed">{message}</p>}
          <div>
            <input
              id="password-modal-input"
              type="password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Passwort"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="flex-1 h-9 rounded-md border border-gray-300 bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
            >Abbrechen</button>
            <button
              type="button"
              onClick={() => onSubmit(value)}
              className="flex-1 h-9 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              disabled={!value}
            >{submitLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
