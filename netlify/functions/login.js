// netlify/functions/login.js
const bcrypt = require('bcryptjs');
const connectDB = require('./utils/db');
const { generateToken } = require('./utils/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Email and password required' }),
      };
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Invalid email or password' }),
      };
    }

    const token = generateToken({ email: user.email, name: user.name });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        token,
        user: {
          _id: user._id,                // ✅ include MongoDB ID
          email: user.email,
          name: user.name,
          balance: user.balance || 0,   // ✅ optional: return wallet balance
        },
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Login failed', error: err.message }),
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}
