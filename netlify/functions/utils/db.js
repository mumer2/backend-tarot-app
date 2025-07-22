// utils/db.js or netlify/functions/db.js
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

let cachedDb = null;

async function connectDB() {
  if (cachedDb) return cachedDb;

  await client.connect();
  const db = client.db('tarot-station'); // 👈 ensure you use the correct DB name here
  cachedDb = db;
  return db;
}

module.exports = connectDB;
