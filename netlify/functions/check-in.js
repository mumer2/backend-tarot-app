const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI;

exports.handler = async (event) => {
  const { userId } = JSON.parse(event.body || '{}');

  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing userId' }) };
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('tarot-station');
    const users = db.collection('users');

    const user = await users.findOne({ _id: userId });

    const today = new Date().toDateString(); // reset time
    const lastDate = user.lastCheckIn ? new Date(user.lastCheckIn).toDateString() : null;

    if (lastDate === today) {
      await client.close();
      return {
        statusCode: 200,
        body: JSON.stringify({
          alreadyCheckedIn: false,
          streak: user.checkInStreak || 1,
          history: user.checkInHistory || [],
        }),
      };
    }

    // Check if missed a day
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const missedDay = user.lastCheckIn &&
      new Date(user.lastCheckIn).toDateString() !== yesterday.toDateString();

    const newStreak = missedDay ? 1 : (user.checkInStreak || 0) + 1;
    const cappedStreak = newStreak > 7 ? 1 : newStreak;
    const todayReward = cappedStreak * 5;

    const updatedPoints = (user.points || 0) + todayReward;

    const newHistory = [
      ...(user.checkInHistory || []),
      { date: today, coins: todayReward },
    ];

    await users.updateOne(
      { _id: userId },
      {
        $set: {
          points: updatedPoints,
          checkInStreak: cappedStreak,
          lastCheckIn: new Date(),
          checkInHistory: newHistory,
        },
      }
    );

    await client.close();

    return {
      statusCode: 200,
      body: JSON.stringify({
        alreadyCheckedIn: false,
        todayReward,
        newPoints: updatedPoints,
        streak: cappedStreak,
        history: newHistory,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Server error', error: err.message }) };
  }
};
