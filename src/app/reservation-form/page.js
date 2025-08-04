'use client';

import { Suspense } from 'react';
import ReservationFormPage from '../../components/ReservationFormPage';

function ReservationFormContent() {
  return <ReservationFormPage />;
}

export default function ReservationForm() {
  return (
    <Suspense fallback={<div>Lädt...</div>}>
      <ReservationFormContent />
    </Suspense>
  );
}
