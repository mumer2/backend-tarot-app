// netlify/functions/order-status.js
const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGO_URI;
const mongoDbName = 'tarot-station';

let cachedDb;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  cachedDb = client.db(mongoDbName);
  return cachedDb;
}

exports.handler = async (event) => {
  const outTradeNo = event.queryStringParameters?.outTradeNo;
  if (!outTradeNo) {
    return { statusCode: 400, body: JSON.stringify({ error: 'outTradeNo is required' }) };
  }

  try {
    const db = await connectToDatabase();
    const order = await db.collection('orders').findOne({ outTradeNo });
    return { statusCode: 200, body: JSON.stringify(order || {}) };
  } catch (err) {
    console.error('order-status error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server Error' }) };
  }
};
