const { MongoClient } = require('mongodb');

// 🔐 Secure values
const MONGO_URI = process.env.MONGO_DB_URI;

// 📱 Format phone number same as send-code.js
const formatPhoneNumber = (phone, countryCode = '92') => {
  let formatted = phone.trim().replace(/\s+/g, '');

  if (formatted.startsWith('+')) {
    formatted = formatted.slice(1);
  }

  if (formatted.startsWith('00')) {
    formatted = formatted.slice(2);
  }

  if (formatted.startsWith('0')) {
    formatted = formatted.slice(1);
  }

  if (!formatted.startsWith(countryCode)) {
    formatted = `${countryCode}${formatted}`;
  }

  return formatted;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let mongo;

  try {
    const { phone, code } = JSON.parse(event.body);
    if (!phone || !code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Phone and code are required.' }),
      };
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log('🔍 Verifying for phone:', formattedPhone);

    mongo = new MongoClient(MONGO_URI);
    await mongo.connect();

    const record = await mongo
      .db('calorieai')
      .collection('otp_verifications')
      .findOne({ phone: formattedPhone });

    if (!record) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'No OTP found for this number.' }),
      };
    }

    const now = new Date();
    const createdAt = new Date(record.createdAt);
    const diffInMinutes = (now - createdAt) / (1000 * 60);

    if (record.code !== code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Invalid verification code.' }),
      };
    }

    if (diffInMinutes > 5) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'OTP expired. Please request a new one.' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Phone number verified successfully.' }),
    };
  } catch (err) {
    console.error('❌ Error verifying code:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Internal server error.', error: err.message }),
    };
  } finally {
    if (mongo) await mongo.close();
  }
};
