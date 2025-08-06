// File: netlify/functions/check-in.js
const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId } = JSON.parse(event.body);
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ message: 'User ID missing' }) };
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('tarot-station');
    const users = db.collection('users');

    const user = await users.findOne({ _id: userId });
    if (!user) {
      return { statusCode: 404, body: JSON.stringify({ message: 'User not found' }) };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastCheckIn = user.lastCheckIn ? new Date(user.lastCheckIn) : null;

    if (lastCheckIn && lastCheckIn >= today) {
      await client.close();
      return {
        statusCode: 200,
        body: JSON.stringify({ alreadyCheckedIn: true, coins: user.points }),
      };
    }

    const updated = await users.findOneAndUpdate(
      { _id: userId },
      {
        $set: { lastCheckIn: new Date() },
        $inc: { points: 10 },
        $push: {
          checkInHistory: {
            date: new Date(),
            coins: 10,
          },
        },
      },
      { returnDocument: 'after' }
    );

    await client.close();
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        newPoints: updated.value.points,
        history: updated.value.checkInHistory,
      }),
    };
  } catch (err) {
    console.error('❌ Check-in error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: err.message }),
    };
  }
};
