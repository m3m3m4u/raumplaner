import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// .env.local laden
dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

console.log('MongoDB URI:', uri ? 'SET' : 'NOT SET');
console.log('MongoDB DB:', dbName);

async function testConnection() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    const client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db(dbName);
    console.log('Database:', db.databaseName);
    
    // Collections auflisten
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Räume prüfen
    const roomsCollection = db.collection('rooms');
    const roomCount = await roomsCollection.countDocuments();
    console.log('Rooms count:', roomCount);
    
    const rooms = await roomsCollection.find({}).limit(5).toArray();
    console.log('Sample rooms:', rooms);
    
    // Reservierungen prüfen
    const reservationsCollection = db.collection('reservations');
    const reservationCount = await reservationsCollection.countDocuments();
    console.log('Reservations count:', reservationCount);
    
    const reservations = await reservationsCollection.find({}).limit(5).toArray();
    console.log('Sample reservations:', reservations);
    
    // Schedule prüfen
    const scheduleCollection = db.collection('schedule');
    const scheduleCount = await scheduleCollection.countDocuments();
    console.log('Schedule count:', scheduleCount);
    
    const schedule = await scheduleCollection.find({}).toArray();
    console.log('Schedule:', schedule);
    
    await client.close();
    console.log('Connection closed.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();
