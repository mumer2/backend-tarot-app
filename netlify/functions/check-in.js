const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI;

exports.handler = async (event) => {
  const method = event.httpMethod;

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('tarot-station');
    const users = db.collection('users');

    if (method === 'GET') {
      // 👉 GET: Load status and history
      const userId = event.queryStringParameters.userId;
      if (!userId) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing userId' }) };
      }

      const user = await users.findOne({ _id: userId });
      if (!user) {
        return { statusCode: 404, body: JSON.stringify({ message: 'User not found' }) };
      }

      const today = new Date().toISOString().split('T')[0];
      const lastCheckInDate = user.lastCheckInDate || null;
      const alreadyCheckedIn = lastCheckInDate === today;

      const history = user.checkInHistory || [];
      const streak = user.checkInStreak || 1;
      const todayReward = Math.min(5 * streak, 35);

      return {
        statusCode: 200,
        body: JSON.stringify({ alreadyCheckedIn, history, streak, todayReward }),
      };
    }

    if (method === 'POST') {
      // 👉 POST: Perform check-in
      const { userId } = JSON.parse(event.body);
      if (!userId) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing userId' }) };
      }

      const user = await users.findOne({ _id: userId });
      if (!user) {
        return { statusCode: 404, body: JSON.stringify({ message: 'User not found' }) };
      }

      const today = new Date().toISOString().split('T')[0];
      const lastCheckInDate = user.lastCheckInDate || null;

      if (lastCheckInDate === today) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            alreadyCheckedIn: true,
            history: user.checkInHistory || [],
            streak: user.checkInStreak || 1,
            todayReward: Math.min(5 * (user.checkInStreak || 1), 35),
          }),
        };
      }

      // Check if yesterday was last check-in to continue streak
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const newStreak = lastCheckInDate === yesterday ? (user.checkInStreak || 1) + 1 : 1;

      const todayReward = Math.min(5 * newStreak, 35);
      const updatedPoints = (user.points || 0) + todayReward;

      const updatedHistory = [...(user.checkInHistory || []), {
        date: new Date().toISOString(),
        coins: todayReward,
      }];

      await users.updateOne(
        { _id: userId },
        {
          $set: {
            lastCheckInDate: today,
            checkInStreak: newStreak,
            points: updatedPoints,
            checkInHistory: updatedHistory,
          },
        }
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          alreadyCheckedIn: false,
          newPoints: updatedPoints,
          todayReward,
          streak: newStreak,
          history: updatedHistory,
        }),
      };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error('❌ Check-in error:', err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Server error', error: err.message }) };
  }
};
