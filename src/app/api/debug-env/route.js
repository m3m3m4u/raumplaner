import { NextResponse } from 'next/server';

export async function GET() {
  // Vorsicht: Gibt nur verkürzte / maskierte Infos für Debug (nicht in Prod lassen)
  const uri = process.env.MONGODB_URI || ''; 
  const db = process.env.MONGODB_DB || '';
  return NextResponse.json({
    vercel: !!process.env.VERCEL,
    hasUri: !!uri,
    uriStart: uri.substring(0, 35),
    uriMasked: uri.replace(/:\/\/.+?:.+?@/, '://***:***@'),
    db,
    nodeVersion: process.version,
    envKeys: Object.keys(process.env).filter(k => k.startsWith('MONGODB_'))
  });
}
