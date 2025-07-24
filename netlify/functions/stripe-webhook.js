const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// Required to read raw body
const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    try {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(Buffer.from(data)));
    } catch (err) {
      reject(err);
    }
  });

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let bodyBuffer;
  try {
    bodyBuffer = await getRawBody(event);
  } catch (err) {
    return { statusCode: 400, body: 'Raw body error' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(bodyBuffer, sig, webhookSecret);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed.', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    const userId = session.metadata?.userId;
    const amount = session.amount_total / 100;

    if (userId) {
      try {
        const uri = process.env.MONGODB_URI;
        const client = new MongoClient(uri);
        await client.connect();
        const db = client.db('tarot-station');
        const users = db.collection('wallets');

        const existing = await users.findOne({ userId });
        if (existing) {
          await users.updateOne({ userId }, { $inc: { balance: amount } });
        } else {
          await users.insertOne({ userId, balance: amount });
        }

        console.log(`✅ Wallet updated for ${userId}: +${amount} USD`);
        await client.close();
      } catch (dbErr) {
        console.error('DB update error:', dbErr);
        return { statusCode: 500, body: 'Database error' };
      }
    }
  }

  return { statusCode: 200, body: 'Webhook received' };
};
