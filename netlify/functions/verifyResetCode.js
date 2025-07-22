// netlify/functions/verifyResetCode.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGO_URI);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, token } = JSON.parse(event.body);
    if (!email || !token) {
      return { statusCode: 400, body: 'Missing email or token' };
    }

    await client.connect();
    const db = client.db('tarot-station');
    const record = await db.collection('reset_tokens').findOne({ email, token });

    if (!record) {
      return { statusCode: 400, body: 'Invalid or expired code' };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Code verified' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
