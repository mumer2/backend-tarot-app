// netlify/functions/getWalletHistory.js

const { MongoClient } = require('mongodb');
require('dotenv').config();

let cachedClient = null;
let cachedDb = null;

async function connectToDB() {
  if (cachedDb) return cachedDb;

  const client = cachedClient || new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  if (!cachedClient) {
    await client.connect();
    cachedClient = client;
  }

  const dbName = 'tarot-station'; // 👈 hardcoded database name
  cachedDb = client.db(dbName);
  return cachedDb;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Missing userId' }),
      };
    }

    const db = await connectToDB();

    const history = await db
      .collection('wallet_history')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ success: true, history }),
    };
  } catch (error) {
    console.error('History fetch error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Server error', error: error.message }),
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}
