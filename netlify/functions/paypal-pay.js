const axios = require('axios');

const CLIENT_ID = 'YOUR_SANDBOX_CLIENT_ID';
const SECRET = 'YOUR_SANDBOX_SECRET';
const PAYPAL_API = 'https://api-m.sandbox.paypal.com';

exports.handler = async function (event, context) {
  try {
    // Step 1: Get access token
    const auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');

    const tokenRes = await axios.post(
      `${PAYPAL_API}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Step 2: Create order
    const orderRes = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: '10.00',
            },
          },
        ],
        application_context: {
          return_url: 'https://your-site.netlify.app/success',
          cancel_url: 'https://your-site.netlify.app/cancel',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const approvalUrl = orderRes.data.links.find(link => link.rel === 'approve')?.href;

    return {
      statusCode: 200,
      body: JSON.stringify({ approvalUrl }),
    };
  } catch (err) {
    console.error('PayPal error:', err.response?.data || err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Payment creation failed' }),
    };
  }
};
