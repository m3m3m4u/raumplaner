'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modal, setModal] = useState({ open: false, content: null });

  const openModal = useCallback((content) => {
    setModal({ open: true, content });
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const closeModal = useCallback(() => {
    setModal({ open: false, content: null });
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }, []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {modal.open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative bg-white max-w-2xl w-full rounded-xl shadow-2xl p-8">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              aria-label="Schließen"
            >✕</button>
            {modal.content}
          </div>
        </div>, document.body)
      }
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal muss innerhalb ModalProvider verwendet werden');
  return ctx;
}
