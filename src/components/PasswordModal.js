'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function PasswordModal({ open, title = 'Passwort eingeben', message, onSubmit, onCancel, submitLabel = 'Bestätigen', error, loading = false }) {
  const [value, setValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setValue('');
      setShowPassword(false);
      setTimeout(() => {
        const el = document.getElementById('password-modal-input');
        if (el) el.focus();
      }, 50);
    }
  }, [open]);

  if (!open) return null;

  const handleKey = (e) => {
    if (e.key === 'Enter' && value && !loading) {
      e.preventDefault();
      onSubmit(value);
    } else if (e.key === 'Escape' && !loading) {
      e.preventDefault();
      onCancel?.();
    }
  };

  return (
    <div
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onKeyDown={handleKey}
    >
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-gray-100 overflow-hidden transform transition-all">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <h2 id="password-modal-title" className="text-base font-semibold text-gray-900 leading-tight">
            {title}
          </h2>
        </div>

        <div className="px-5 py-4 space-y-3.5 text-sm">
          {message && <p className="text-gray-600 leading-relaxed text-[13.5px]">{message}</p>}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <input
                id="password-modal-input"
                type={showPassword ? 'text' : 'password'}
                disabled={loading}
                className={`w-full border rounded-lg pl-3 pr-10 py-2 text-sm transition-colors focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                  error ? 'border-red-300 focus:ring-red-400 focus:border-red-400' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Passwort eingeben"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-600 focus:outline-none rounded transition-colors"
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs font-medium text-red-600 pt-0.5">{error}</p>}
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => onCancel?.()}
              className="flex-1 h-9 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={!value || loading}
              onClick={() => onSubmit(value)}
              className="flex-1 h-9 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Prüfe...</span>
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
