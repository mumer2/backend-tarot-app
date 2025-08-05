const connectDB = require('./utils/db'); // backend-only
const { ObjectId } = require('mongodb');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const { userId, name, profilePic } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing userId' }),
      };
    }

    const db = await connectDB();

    await db.collection('users').updateOne(
      { _id: userId },
      { $set: { name, profilePic } }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Profile updated' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Update failed', error: error.message }),
    };
  }
};
