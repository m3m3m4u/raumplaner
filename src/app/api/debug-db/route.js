import { NextResponse } from 'next/server';

export async function GET() {
  const diag = globalThis.__mongoDiag;
  if (!diag) {
    return NextResponse.json({ initialized: false, message: 'Noch kein Verbindungsversuch (getDb nie aufgerufen)' });
  }
  return NextResponse.json({ initialized: true, ...diag });
}
