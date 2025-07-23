const https = require('https');
const fs = require('fs');
const axios = require('axios');

exports.handler = async (event) => {
  try {
    const { amount, userId, validationUrl } = JSON.parse(event.body);
    if (!amount || !userId || !validationUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing amount, userId, or validationUrl' })
      };
    }

    const merchantCert = fs.readFileSync('./apple_pay_cert.pem');
    const merchantKey = fs.readFileSync('./apple_pay_key.pem');

    const agent = new https.Agent({
      cert: merchantCert,
      key: merchantKey
    });

    const sessionRes = await axios.post(
      validationUrl,
      {
        merchantIdentifier: 'merchant.com.yourapp',
        displayName: 'Tarot Recharge',
        initiative: 'web',
        initiativeContext: 'your.domain'
      },
      { httpsAgent: agent }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(sessionRes.data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Apple Pay error', details: error.message })
    };
  }
};
