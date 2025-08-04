// netlify/functions/verify-otp.js
const connectDB = require('./utils/db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { phone, otp } = JSON.parse(event.body);
    if (!phone || !otp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Phone and OTP are required' }),
      };
    }

    const db = await connectDB();

    const record = await db.collection('otps').findOne({ phone });

    if (!record) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, message: 'No OTP found' }),
      };
    }

    const isExpired = new Date() - new Date(record.createdAt) > 5 * 60 * 1000; // 5 minutes
    if (isExpired) {
      await db.collection('otps').deleteOne({ phone });
      return {
        statusCode: 410,
        body: JSON.stringify({ success: false, message: 'OTP expired' }),
      };
    }

    if (record.code !== otp) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'Invalid OTP' }),
      };
    }

    // OTP is valid, delete it
    await db.collection('otps').deleteOne({ phone });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'OTP verification failed',
        error: error.message,
      }),
    };
  }
};
