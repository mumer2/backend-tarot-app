const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGO_URI);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, amount } = JSON.parse(event.body);

    if (!userId || !amount) {
      return { statusCode: 400, body: 'Missing data' };
    }

    await client.connect();
    const db = client.db('tarot-station');

    await db.collection('users').updateOne(
      { _id: userId },
      { $inc: { wallet: parseFloat(amount) } }
    );

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('Wallet error:', error.message);
    return { statusCode: 500, body: error.message };
  }
};
