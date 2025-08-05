const connectDB = require('./utils/db');

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
    const { userId, name, profilePic } = JSON.parse(event.body);

    if (!userId || !name) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'User ID and name are required.' }),
      };
    }

    const db = await connectDB();
    const users = db.collection('users');

    const result = await users.updateOne(
      { _id: userId },
      {
        $set: {
          name,
          profilePic: profilePic || null,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'User not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ success: true, message: 'Profile updated' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Update failed', error: err.message }),
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
