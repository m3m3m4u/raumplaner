import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    if (db) {
      // Test basic connection
      const collections = await db.listCollections().toArray();
      return NextResponse.json({ 
        success: true, 
        message: 'MongoDB erfolgreich verbunden!',
        database: db.databaseName,
        collections: collections.map(c => c.name)
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'MongoDB nicht konfiguriert - nutze lokale JSON-Dateien'
      });
    }
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
