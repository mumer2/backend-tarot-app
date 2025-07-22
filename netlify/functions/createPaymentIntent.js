const stripe = require('stripe')(process.env.Secret_key);
const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGO_URI);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const { amount, userId } = JSON.parse(event.body);

    // 🛡️ Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid or missing amount' }),
      };
    }

    // 🛡️ Validate userId
    if (!userId || typeof userId !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid or missing userId' }),
      };
    }

    // 🧾 Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.floor(amount * 100), // cents
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: { userId },
    });

    // 💾 Store in wallet_history (not wallet_transactions)
    await client.connect();
    const db = client.db('tarot-station'); // ✅ match your DB name

    await db.collection('wallet_history').insertOne({
      userId,
      amount,
      currency: 'usd',
      paymentIntentId: paymentIntent.id,
      status: 'pending', // will stay pending unless updated later
      createdAt: new Date(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (error) {
    console.error('❌ Stripe or DB error:', error.message);

    if (error.type === 'StripeCardError') {
      return {
        statusCode: 402,
        body: JSON.stringify({ message: error.message }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server Error: ' + error.message }),
    };
  }
};
