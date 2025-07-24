const axios = require('axios');

// Load from Netlify env vars (.env or Netlify Dashboard)
const CLIENT_ID = process.env.YOUR_SANDBOX_CLIENT_ID;
const SECRET = process.env.YOUR_SANDBOX_SECRET;
const PAYPAL_API = 'https://api-m.sandbox.paypal.com';

exports.handler = async function (event, context) {
  try {
    console.log('📦 [create-order] Function triggered');

    const body = JSON.parse(event.body || '{}');
    const amount = body.amount || 10;

    if (!CLIENT_ID || !SECRET) {
      console.error('❌ Missing PayPal credentials');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing PayPal credentials' })
      };
    }

    if (!amount || isNaN(amount)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid amount' })
      };
    }

    // Step 1: Get access token
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

    // Step 2: Create order
    const orderRes = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD', // or 'CNY' if supported
              value: amount.toString()
            }
          }
        ],
        application_context: {
          brand_name: 'Tarot Station',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: 'https://your-site.netlify.app/success',
          cancel_url: 'https://your-site.netlify.app/cancel'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const approvalUrl = orderRes.data.links.find(link => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Approval URL not found' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ approvalUrl })
    };
  } catch (err) {
    console.error('❌ PayPal error:', err.response?.data || err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'PayPal error',
        message: err.response?.data || err.message
      })
    };
  }
};
