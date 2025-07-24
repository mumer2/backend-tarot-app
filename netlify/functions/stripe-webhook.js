const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  let bodyBuffer = Buffer.from(event.body, 'base64');

  try {
    stripeEvent = stripe.webhooks.constructEvent(bodyBuffer, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Stripe signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    const userId = session.metadata?.userId;
    const amount = session.amount_total / 100;

    if (!userId) {
      console.warn('⚠️ Missing userId in metadata');
      return { statusCode: 400, body: 'Missing userId' };
    }

    try {
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();

      const db = client.db('tarot-station');
      const users = db.collection('wallets');

      const existing = await users.findOne({ userId });

      if (existing) {
        await users.updateOne({ userId }, { $inc: { balance: amount } });
      } else {
        await users.insertOne({ userId, balance: amount });
      }

      console.log(`✅ Wallet updated for user ${userId}: +${amount} USD`);
      await client.close();
    } catch (err) {
      console.error('❌ Database error:', err.message);
      return { statusCode: 500, body: 'Database update failed' };
    }
  }

  return { statusCode: 200, body: 'Webhook received' };
};
