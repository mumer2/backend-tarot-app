const axios = require('axios');

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;  // ✅ must match Netlify env var name
const SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = 'https://api-m.sandbox.paypal.com';

exports.handler = async function (event) {
  try {
    console.log('📦 PayPal create-order triggered');

    const body = JSON.parse(event.body || '{}');
    const amount = body.amount || 10;

    if (!CLIENT_ID || !SECRET) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing PayPal credentials from env vars' })
      };
    }

    if (!amount || isNaN(amount)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid amount' })
      };
    }

    // 🔐 Step 1: Get access token
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

    // 💵 Step 2: Create order
    const orderRes = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: amount.toString()
            }
          }
        ],
        application_context: {
          brand_name: 'Tarot Station',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: 'https://successscreen.netlify.app/success.html',
          cancel_url: 'https://successscreen.netlify.app/cancel.html'
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
