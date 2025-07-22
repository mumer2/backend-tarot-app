// netlify/functions/setNewPassword.js
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGO_URI);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, token, newPassword } = JSON.parse(event.body);

    if (!email || !token || !newPassword) {
      return { statusCode: 400, body: 'Missing required fields' };
    }

    await client.connect();
    const db = client.db('tarot-station');

    // Verify token
    const validToken = await db.collection('reset_tokens').findOne({ email, token });
    if (!validToken) {
      return { statusCode: 400, body: 'Invalid or expired token' };
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection('users').updateOne({ email }, { $set: { password: hashed } });

    // Delete token after use
    await db.collection('reset_tokens').deleteMany({ email });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Password updated' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
