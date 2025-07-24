const axios = require('axios');

const CLIENT_ID = 'YOUR_SANDBOX_CLIENT_ID'; // Replace with your actual Sandbox Client ID
const SECRET = 'YOUR_SANDBOX_SECRET';       // Replace with your actual Sandbox Secret
const PAYPAL_API = 'https://api-m.sandbox.paypal.com';

exports.handler = async function (event, context) {
  try {
    console.log('⚙️ PayPal create-order function called');

    const body = JSON.parse(event.body || '{}');
    const amount = body.amount || 10.00; // fallback to 10 RMB if none provided

    if (!amount || isNaN(amount)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid amount' })
      };
    }

    // Step 1: Generate Access Token
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
    console.log('✅ Access token obtained');

    // Step 2: Create PayPal Order
    const orderRes = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD', // or 'CNY' if your account supports it
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

    console.log('✅ PayPal order created');

    return {
      statusCode: 200,
      body: JSON.stringify({ approvalUrl })
    };
  } catch (err) {
    console.error('❌ PayPal API Error:', err.response?.data || err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'PayPal server error',
        message: err.response?.data || err.message
      })
    };
  }
};
