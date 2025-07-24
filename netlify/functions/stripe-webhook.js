const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    const bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    stripeEvent = stripe.webhooks.constructEvent(bodyBuffer, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Stripe signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  // ✅ Handle only successful payments
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const userId = session.metadata?.userId;
    const amount = session.amount_total / 100;

    if (!userId) {
      console.warn('⚠️ Missing userId in metadata');
      return { statusCode: 400, body: 'Missing userId in metadata' };
    }

    try {
      const db = await connectToDatabase(process.env.MONGO_URI);
      const wallets = db.collection('wallets');
      const recharges = db.collection('wallet_history');

      // Update wallet balance
      const result = await wallets.updateOne(
        { userId },
        { $inc: { balance: amount } },
        { upsert: true }
      );

      // Save recharge history
      await recharges.insertOne({
        userId,
        amount,
        method: 'Stripe (Apple Pay)',
        timestamp: new Date(),
        sessionId: session.id,
        email: session.customer_email || '',
        status: 'completed'
      });

      console.log(`✅ Wallet updated and recharge logged for user ${userId}: +${amount} USD`);
    } catch (err) {
      console.error('❌ Database error:', err.message);
      return {
        statusCode: 500,
        body: 'Database update failed',
      };
    }
  }

  return {
    statusCode: 200,
    body: 'Webhook received',
  };
};
