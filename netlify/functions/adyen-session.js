// 📦 Backend: Node.js (Express-style function for Adyen H5 payments)
// File: adyen-session.js

const axios = require('axios');

exports.handler = async (event) => {
  try {
    const { amount, userId, method } = JSON.parse(event.body);

    if (!amount || amount < 1 || !userId || !method) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing or invalid parameters.' })
      };
    }

    const paymentMethods = {
      wechat: 'wechatpayWeb',
      alipay: 'alipay',
      apple: 'applepay'
    };

    const sessionRes = await axios.post(
      'https://checkout-test.adyen.com/v70/sessions',
      {
        amount: {
          currency: 'CNY',
          value: amount * 100 // Adyen accepts value in cents
        },
        reference: `order-${Date.now()}`,
        merchantAccount: 'YOUR_MERCHANT_ACCOUNT',
        returnUrl: 'https://yourdomain.com/return',
        countryCode: 'CN',
        channel: 'Web',
        shopperLocale: 'zh-CN'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'YOUR_ADYEN_API_KEY'
        }
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ paymentUrl: sessionRes.data.url })
    };
  } catch (err) {
    console.error('Adyen error:', err.response?.data || err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Payment session creation failed.' })
    };
  }
};
