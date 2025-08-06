const { MongoClient } = require('mongodb');

let cachedDb = null;

const connectToDatabase = async (uri) => {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  cachedDb = client.db('tarot-station');
  return cachedDb;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { userId, amount } = JSON.parse(event.body);

    if (!userId || typeof amount !== 'number' || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing or invalid userId or amount' }),
      };
    }

    const db = await connectToDatabase(process.env.MONGO_URI);
    const wallets = db.collection('wallets');

    const user = await wallets.findOne({ userId });

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    if (user.balance < amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Insufficient balance' }),
      };
    }

    const newBalance = user.balance - amount;

    await wallets.updateOne(
      { userId },
      { $set: { balance: newBalance } }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ balance: newBalance }),
    };
  } catch (err) {
    console.error('❌ Error deducting balance:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
