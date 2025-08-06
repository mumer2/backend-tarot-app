// File: netlify/functions/check-in.js
const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  const { userId } = JSON.parse(event.body);
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

    const user = await users.findOne({ _id: userId });
    if (!user) {
      await client.close();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' }),
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastCheckInDate = user.lastCheckInDate ? new Date(user.lastCheckInDate) : null;
    const streak = user.streak || 0;

    if (lastCheckInDate && lastCheckInDate.getTime() === today.getTime()) {
      await client.close();
      return {
        statusCode: 200,
        body: JSON.stringify({ alreadyCheckedIn: true, message: 'Already checked in today.' }),
      };
    }

    let newStreak = 1;
    if (lastCheckInDate) {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (lastCheckInDate.getTime() === yesterday.getTime()) {
        newStreak = streak + 1;
        if (newStreak > 7) newStreak = 1;
      }
    }

    const coinsToAdd = newStreak * 5; // 5, 10, ..., 35
    const newPoints = (user.points || 0) + coinsToAdd;
    const newHistory = user.checkInHistory || [];

    newHistory.push({ date: today.toISOString(), coins: coinsToAdd });

    await users.updateOne(
      { _id: userId },
      {
        $set: {
          points: newPoints,
          lastCheckInDate: today.toISOString(),
          streak: newStreak,
          checkInHistory: newHistory,
        },
      }
    );

    await client.close();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Check-in successful',
        newPoints,
        coinsAwarded: coinsToAdd,
        streak: newStreak,
        history: newHistory,
      }),
    };
  } catch (error) {
    console.error('❌ check-in error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
    };
  }
};
