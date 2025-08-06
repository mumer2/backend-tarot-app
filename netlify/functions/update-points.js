const connectDB = require('./utils/db');
const { ObjectId } = require('mongodb');

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
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const { userId, coinsToDeduct } = JSON.parse(event.body);

    if (!userId || !coinsToDeduct || coinsToDeduct <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Invalid request' }),
      };
    }

    const db = await connectDB();
    const users = db.collection('users');

    const _id = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;

    const user = await users.findOne({ _id });

    if (!user) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'User not found' }),
      };
    }

    const currentPoints = user.points || 0;

    if (currentPoints < coinsToDeduct) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Not enough coins' }),
      };
    }

    const updatedResult = await users.findOneAndUpdate(
      { _id },
      { $inc: { points: -coinsToDeduct } },
      { returnDocument: 'after' }
    );

    const updatedUser = updatedResult.value;

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        updatedPoints: updatedUser.points,
      }),
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
