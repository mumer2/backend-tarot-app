const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { amount, userId } = JSON.parse(event.body);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Apple Pay will show automatically on supported devices
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Wallet Recharge'
            },
            unit_amount: Math.round(amount * 100)
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `https://yourdomain.com/success.html?userId=${userId}`,
      cancel_url: `https://yourdomain.com/cancel.html?userId=${userId}`,
      metadata: {
        userId
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ paymentUrl: session.url })
    };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Apple Pay failed', message: err.message })
    };
  }
};
