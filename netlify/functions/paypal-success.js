const axios = require('axios');

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;  // ✅ must match Netlify env var name
const SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = 'https://api-m.sandbox.paypal.com';

exports.handler = async (event) => {
  const orderId = event.queryStringParameters.orderId;
  if (!orderId) {
    return {
      statusCode: 400,
      body: 'Missing orderId'
    };
  }

  try {
    const auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
    const tokenRes = await axios.post(
      `${PAYPAL_API}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Capture the order (this charges the user)
    const captureRes = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // ✅ Here you update the wallet based on capture amount
    const amount = parseFloat(captureRes.data.purchase_units[0].payments.captures[0].amount.value);

    // Example: Log or update DB
    console.log(`💰 Received ${amount} USD`);

    // 👉 If you are storing wallet per user, update wallet here
    // Example: Update MongoDB, Firebase, or custom logic

   return {
  statusCode: 302,
  headers: {
    Location: 'https://successscreen.netlify.app/success.html'
  },
  body: ''
};

  } catch (err) {
    console.error('❌ PayPal success error:', err.response?.data || err.message);
    return {
      statusCode: 500,
      body: 'Failed to capture order'
    };
  }
};
