const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const userId = body.userId;
    const points = body.points;

    if (!userId || typeof points !== 'number') {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Missing userId or points' }),
      };
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('tarot-station');
    const users = db.collection('users');

    const result = await users.updateOne(
      { _id: userId },
      { $set: { points } }
    );

    await client.close();

    if (result.modifiedCount === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'User not found or points not updated' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Points updated successfully' }),
    };
  } catch (err) {
    console.error('❌ update-points error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Server error', error: err.message }),
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
