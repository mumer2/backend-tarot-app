const { MongoClient } = require('mongodb');

let cachedDb = null;

const connectToDatabase = async (uri) => {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri);
  await client.connect();
  cachedDb = client.db('tarot-station');
  return cachedDb;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId } = JSON.parse(event.body);
    if (!userId) return { statusCode: 400, body: 'Missing userId' };

    const db = await connectToDatabase(process.env.MONGO_URI);
    const recharges = db.collection('wallet_history');

    const history = await recharges
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    return {
      statusCode: 200,
      body: JSON.stringify({ history }),
    };
  } catch (err) {
    console.error('❌ Error fetching recharge history:', err.message);
    return { statusCode: 500, body: 'Failed to fetch recharge history' };
  }
};
