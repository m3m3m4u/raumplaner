import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

const newSchedule = [
  { id: 1, name: "1.", startTime: "08:00", endTime: "08:50" },
  { id: 2, name: "2a", startTime: "08:50", endTime: "09:15" },
  { id: 3, name: "2b", startTime: "09:15", endTime: "09:40" },
  { id: 4, name: "3.", startTime: "09:45", endTime: "10:35" },
  { id: 5, name: "4.", startTime: "10:55", endTime: "11:45" },
  { id: 6, name: "5a", startTime: "11:45", endTime: "12:10" },
  { id: 7, name: "5b", startTime: "12:15", endTime: "12:40" },
  { id: 8, name: "6.", startTime: "12:40", endTime: "13:05" },
  { id: 9, name: "7.", startTime: "13:05", endTime: "13:55" },
  { id: 10, name: "8.", startTime: "13:55", endTime: "14:45" },
  { id: 11, name: "9.", startTime: "14:45", endTime: "15:35" },
  { id: 12, name: "10a", startTime: "15:35", endTime: "16:00" },
  { id: 13, name: "Abend 1", startTime: "16:00", endTime: "18:00" },
  { id: 14, name: "Abend 2", startTime: "18:00", endTime: "20:00" },
  { id: 15, name: "Abend 3", startTime: "20:00", endTime: "22:00" }
];

async function updateSchedule() {
  if (!uri || !dbName) {
    console.error('MongoDB URI or DB Name not set in .env.local');
    return;
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const scheduleCollection = db.collection('schedule');

    console.log('Deleting old schedule...');
    await scheduleCollection.deleteMany({});
    console.log('Old schedule deleted.');

    console.log('Inserting new schedule...');
    await scheduleCollection.insertMany(newSchedule);
    console.log(`Successfully inserted ${newSchedule.length} new schedule periods.`);

  } catch (error) {
    console.error('An error occurred during the schedule update:', error);
  } finally {
    await client.close();
    console.log('Connection to MongoDB closed.');
  }
}

updateSchedule();
