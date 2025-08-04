// netlify/functions/send-otp.js
const axios = require('axios');
const connectDB = require('./utils/db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { phone } = JSON.parse(event.body);
    if (!phone) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Phone number is required' }) };
    }

    const ACCOUNT_ID = process.env.LMLOBILE_ACCOUNT_ID;
    const PASSWORD = process.env.LMLOBILE_PASSWORD;
    const PRODUCT_ID = process.env.LMLOBILE_PRODUCT_ID;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const content = `【Tarot App】您的验证码是 ${code}，5分钟内有效。`;

    const url = 'https://smsapi.lmobile.cn/smsSend.do';

    const params = new URLSearchParams({
      userid: ACCOUNT_ID,
      password: PASSWORD,
      mobile: phone,
      content,
      productid: PRODUCT_ID,
      xh: '',
    });

    const response = await axios.post(url, params);

    // Store OTP in DB
    const db = await connectDB();

    // Remove any previous OTP for this phone
    await db.collection('otps').deleteMany({ phone });

    await db.collection('otps').insertOne({
      phone,
      code,
      createdAt: new Date(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'OTP sent',
        response: response.data,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Failed to send OTP',
        error: error.message,
      }),
    };
  }
};
