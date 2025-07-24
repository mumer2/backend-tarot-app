const { MongoClient } = require('mongodb');

let cachedDb = null;

const connectToDatabase = async (uri) => {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
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

    if (!userId) {
      return { statusCode: 400, body: 'Missing userId' };
    }

    const db = await connectToDatabase(process.env.MONGO_URI);
    const wallets = db.collection('wallets');
    const user = await wallets.findOne({ userId });

    const balance = user?.balance || 0;

    return {
      statusCode: 200,
      body: JSON.stringify({ balance }),
    };
  } catch (err) {
    console.error('❌ Error fetching balance:', err.message);
    return { statusCode: 500, body: 'Failed to fetch balance' };
  }
};
