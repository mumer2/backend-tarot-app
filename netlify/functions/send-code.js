const axios = require('axios');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// 🔐 Secure credentials (from Netlify environment variables)
const ACCOUNT_ID = process.env.LMLOBILE_ACCOUNT_ID;
const PASSWORD = process.env.LMLOBILE_PASSWORD;
const PRODUCT_ID = process.env.LMLOBILE_PRODUCT_ID;
const ENCRYPT_KEY = 'SMmsEncryptKey';
const MONGO_URI = process.env.MONGO_URI;

// 🔐 Hashing utilities
const md5 = (input) => crypto.createHash('md5').update(input).digest('hex').toUpperCase();
const sha256 = (input) => crypto.createHash('sha256').update(input).digest('hex').toLowerCase();

// ✅ Validate Chinese mainland phone number (e.g., 13x, 15x, ..., 19x)
const isChinesePhoneNumber = (number) => /^1[3-9]\d{9}$/.test(number);

// ✅ Format phone to remove any `+` and spaces
const formatPhoneNumber = (phone) => {
  let formatted = phone.trim().replace(/\s+/g, '');
  if (formatted.startsWith('+')) formatted = formatted.slice(1);
  return formatted;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let mongo;

  try {
    const { phone } = JSON.parse(event.body);
    console.log('📱 Raw phone:', phone);

    if (!phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Phone number is required.' }),
      };
    }

    // ✅ Restrict to Chinese numbers only
    if (!isChinesePhoneNumber(phone)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Only Chinese phone numbers are supported for OTP.' }),
      };
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log('✅ Final PhoneNos:', formattedPhone);

    // Generate OTP and prepare credentials
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.floor(Math.random() * 9000000000) + 100000000;
    const passwordHash = md5(PASSWORD + ENCRYPT_KEY);
    const accessKeyString = `AccountId=${ACCOUNT_ID}&PhoneNos=${formattedPhone}&Password=${passwordHash}&Random=${random}&Timestamp=${timestamp}`;
    const accessKey = sha256(accessKeyString);

    // 📨 Payload for Welink API
    const requestBody = {
      AccountId: ACCOUNT_ID,
      AccessKey: accessKey,
      Timestamp: timestamp,
      Random: random,
      ExtendNo: '',
      ProductId: PRODUCT_ID,
      PhoneNos: formattedPhone,
      // Content: `【Beijing Zhan Yue Technology】Your verification code is ${code}, and it is valid for 5 minutes.`,
      Content: `【北京展跃科技】您的验证码为${code}，有效期5分钟。`,
      SendTime: '',
      OutId: '',
    };

    console.log('📤 Sending payload:', requestBody);

    const smsRes = await axios.post(
      'https://api.51welink.com/EncryptionSubmit/SendSms.ashx',
      requestBody,
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('📩 SMS Response:', smsRes.data);

    if (smsRes.data.Result !== 'succ') {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          message: smsRes.data.Reason || 'SMS sending failed.',
        }),
      };
    }

    // ✅ Store OTP in MongoDB
    mongo = new MongoClient(MONGO_URI);
    await mongo.connect();
    await mongo
      .db('tarot-station')
      .collection('otps')
      .updateOne(
        { phone: formattedPhone },
        { $set: { code, createdAt: new Date() } },
        { upsert: true }
      );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'OTP sent successfully.' }),
    };
  } catch (error) {
    console.error('❌ Error sending OTP:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error.',
        error: error.message,
      }),
    };
  } finally {
    if (mongo) await mongo.close();
  }
};
