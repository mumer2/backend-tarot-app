const { MongoClient } = require('mongodb');

// 🔐 Secure values
const MONGO_URI = process.env.MONGO_URI;

// 📱 Only allow Chinese numbers: e.g. 13xxxxxxxxx, 15xxxxxxxxx, ...
const isChinesePhoneNumber = (phone) => /^1[3-9]\d{9}$/.test(phone);

// 📱 Format phone (remove spaces, +, etc.)
const formatPhoneNumber = (phone) => {
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

    // 🔐 Ensure phone number is from China
    if (!isChinesePhoneNumber(formattedPhone)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: 'Only Chinese phone numbers are supported for OTP verification.',
        }),
      };
    }

    console.log('🔍 Verifying OTP for:', formattedPhone);

    mongo = new MongoClient(MONGO_URI);
    await mongo.connect();

    const otpDoc = await mongo
      .db('tarot-station')
      .collection('otps')
      .findOne({ phone: formattedPhone });

    if (!otpDoc) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'No OTP found for this number.' }),
      };
    }

    const now = new Date();
    const createdAt = new Date(otpDoc.createdAt);
    const diffInMinutes = (now - createdAt) / (1000 * 60);

    if (otpDoc.code !== code) {
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

    // ✅ Valid OTP
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Phone number verified successfully.' }),
    };
  } catch (err) {
    console.error('❌ Error verifying OTP:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error.',
        error: err.message,
      }),
    };
  } finally {
    if (mongo) await mongo.close();
  }
};
