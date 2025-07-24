const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { amount, userId } = data;

    if (!amount || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Amount and userId are required' }),
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Apple Pay is included here
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Tarot AI Wallet Recharge',
            },
            unit_amount: Math.round(amount * 100), // in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://successscreen.netlify.app/success.html',
      cancel_url: 'https://successscreen.netlify.app/cancel.html',
      metadata: {
        userId,
      },
    });

    // Return full session and URL for client
    return {
      statusCode: 200,
      body: JSON.stringify({
        sessionId: session.id,
        paymentUrl: session.url, // ✅ Must return this
      }),
    };
  } catch (err) {
    console.error('❌ Apple Pay session error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' }),
    };
  }
};
