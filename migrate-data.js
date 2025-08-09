import { MongoClient } from 'mongodb';
import fs from 'fs';
import dotenv from 'dotenv';

// .env.local laden
dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

async function migrate() {
  try {
    console.log('🚀 Starting migration...');
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    
    // Rooms migrieren
    console.log('📁 Migrating rooms...');
    const roomsData = JSON.parse(fs.readFileSync('./data/rooms.json', 'utf8'));
    const roomsCollection = db.collection('rooms');
    
    // Erst alle löschen
    await roomsCollection.deleteMany({});
    
    // Dann neue einfügen
    if (roomsData.length > 0) {
      await roomsCollection.insertMany(roomsData);
      console.log(`✅ Migrated ${roomsData.length} rooms`);
    }
    
    // Reservations migrieren
    console.log('📅 Migrating reservations...');
    const reservationsData = JSON.parse(fs.readFileSync('./data/reservations.json', 'utf8'));
    const reservationsCollection = db.collection('reservations');
    
    // Erst alle löschen
    await reservationsCollection.deleteMany({});
    
    // Reservations haben anderes Format, müssen angepasst werden
    const migratedReservations = reservationsData.map(res => ({
      id: res.id,
      roomId: res.roomId,
      title: res.title,
      description: res.description || '',
      date: new Date(res.startTime).toISOString().split('T')[0], // YYYY-MM-DD
      startTime: new Date(res.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(res.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      createdBy: res.organizer || 'System',
      createdAt: res.createdAt,
      updatedAt: res.updatedAt
    }));
    
    if (migratedReservations.length > 0) {
      await reservationsCollection.insertMany(migratedReservations);
      console.log(`✅ Migrated ${migratedReservations.length} reservations`);
    }
    
    // Counters aktualisieren
    console.log('🔢 Updating counters...');
    const countersCollection = db.collection('counters');
    
    const maxRoomId = roomsData.length > 0 ? Math.max(...roomsData.map(r => r.id)) : 0;
    const maxReservationId = reservationsData.length > 0 ? Math.max(...reservationsData.map(r => r.id)) : 0;
    
    await countersCollection.updateOne(
      { _id: 'rooms' },
      { $set: { seq: maxRoomId } },
      { upsert: true }
    );
    
    await countersCollection.updateOne(
      { _id: 'reservations' },
      { $set: { seq: maxReservationId } },
      { upsert: true }
    );
    
    console.log(`✅ Set rooms counter to ${maxRoomId}`);
    console.log(`✅ Set reservations counter to ${maxReservationId}`);
    
    await client.close();
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrate();
