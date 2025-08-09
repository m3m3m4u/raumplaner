import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb, getNextSequence } from '../../../lib/mongodb';

export async function POST() {
  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json({ 
        success: false, 
        message: 'MongoDB nicht konfiguriert' 
      }, { status: 400 });
    }

    const dataDir = path.join(process.cwd(), 'data');
    const roomsFile = path.join(dataDir, 'rooms.json');
    const reservationsFile = path.join(dataDir, 'reservations.json');

    let roomsMigrated = 0;
    let reservationsMigrated = 0;

    // Migrate Rooms
    if (fs.existsSync(roomsFile)) {
      const roomsData = JSON.parse(fs.readFileSync(roomsFile, 'utf8'));
      for (const room of roomsData) {
        const existing = await db.collection('rooms').findOne({ id: room.id });
        if (!existing) {
          await db.collection('rooms').insertOne(room);
          roomsMigrated++;
        }
      }
    }

    // Migrate Reservations
    if (fs.existsSync(reservationsFile)) {
      const reservationsData = JSON.parse(fs.readFileSync(reservationsFile, 'utf8'));
      for (const reservation of reservationsData) {
        const existing = await db.collection('reservations').findOne({ id: reservation.id });
        if (!existing) {
          await db.collection('reservations').insertOne(reservation);
          reservationsMigrated++;
        }
      }
    }

    // Update counters
    if (roomsMigrated > 0) {
      const maxRoomId = await db.collection('rooms').findOne({}, { sort: { id: -1 } });
      if (maxRoomId) {
        await db.collection('counters').updateOne(
          { _id: 'rooms' },
          { $set: { seq: maxRoomId.id } },
          { upsert: true }
        );
      }
    }

    if (reservationsMigrated > 0) {
      const maxReservationId = await db.collection('reservations').findOne({}, { sort: { id: -1 } });
      if (maxReservationId) {
        await db.collection('counters').updateOne(
          { _id: 'reservations' },
          { $set: { seq: maxReservationId.id } },
          { upsert: true }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration abgeschlossen',
      roomsMigrated,
      reservationsMigrated
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
