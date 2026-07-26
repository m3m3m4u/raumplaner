import { NextResponse } from 'next/server';

export async function GET(request) {
  const GENERAL_PASSWORD = process.env.ADMIN_GENERAL_PASSWORD || process.env.ADMIN_PASSWORD || '872020';
  const headerPwd = request.headers.get('x-admin-password');
  if (process.env.NODE_ENV === 'production' && String(headerPwd) !== String(GENERAL_PASSWORD)) {
    return NextResponse.json({ error: 'Unbefugter Zugriff' }, { status: 403 });
  }

  const uri = process.env.MONGODB_URI || ''; 
  const db = process.env.MONGODB_DB || '';
  return NextResponse.json({
    vercel: !!process.env.VERCEL,
    hasUri: !!uri,
    db: db ? 'configured' : 'missing',
    envKeys: Object.keys(process.env).filter(k => k.startsWith('MONGODB_'))
  });
}
