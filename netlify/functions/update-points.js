const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

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
    const { userId, points } = JSON.parse(event.body);

    if (!userId || typeof points !== 'number') {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'userId and numeric points are required' }),
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
  } catch (error) {
    console.error('❌ update-points error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        message: 'Server error',
        error: error.message,
      }),
    };
  }
};
