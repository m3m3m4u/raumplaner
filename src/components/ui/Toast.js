'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const toastStyles = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200 icon-emerald',
  error: 'bg-red-50 text-red-800 border-red-200 icon-red',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 icon-amber',
  info: 'bg-blue-50 text-blue-800 border-blue-200 icon-blue',
};

const ToastItem = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const IconComponent = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }[toast.type] || Info;

  const iconColors = {
    success: 'text-emerald-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-bottom-2 ${
        toastStyles[toast.type] || toastStyles.info
      }`}
    >
      <IconComponent className={`w-5 h-5 flex-shrink-0 ${iconColors[toast.type] || iconColors.info}`} />
      <div className="text-sm font-medium pr-2">{toast.message}</div>
      <button
        onClick={() => onClose(toast.id)}
        className="ml-auto p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default function Toast({ toasts = [], onClose }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
