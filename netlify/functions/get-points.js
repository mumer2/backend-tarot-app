const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI; // Make sure this is set in Netlify env vars

exports.handler = async (event) => {
  const userId = event.queryStringParameters.userId;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'User ID is required' }),
    };
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('tarot-station');
    const users = db.collection('users');

    // UUID string instead of ObjectId
    const user = await users.findOne({ _id: userId });
    await client.close();

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ coins: user.points || 0 }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error fetching user points', error: err.message }),
    };
  }
};