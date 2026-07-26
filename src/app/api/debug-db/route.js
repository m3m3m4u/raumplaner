import { NextResponse } from 'next/server';

export async function GET(request) {
  const GENERAL_PASSWORD = process.env.ADMIN_GENERAL_PASSWORD || process.env.ADMIN_PASSWORD || '872020';
  const headerPwd = request.headers.get('x-admin-password');
  if (process.env.NODE_ENV === 'production' && String(headerPwd) !== String(GENERAL_PASSWORD)) {
    return NextResponse.json({ error: 'Unbefugter Zugriff' }, { status: 403 });
  }

  const diag = globalThis.__mongoDiag;
  if (!diag) {
    return NextResponse.json({ initialized: false, message: 'Noch kein Verbindungsversuch (getDb nie aufgerufen)' });
  }
  const safeDiag = { ...diag };
  delete safeDiag.sanitizedUri;
  delete safeDiag.lastStack;
  return NextResponse.json({ initialized: true, ...safeDiag });
}
