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
    const { name, email, phone, password } = JSON.parse(event.body);

    // ✅ Required fields
    if (!name || !password || (!email && !phone)) {
      return errorResponse(400, 'Name, password, and either email or phone are required');
    }

    // ✅ Name validation
    if (name.trim().length < 2) {
      return errorResponse(400, 'Name must be at least 2 characters long');
    }

    // ✅ Password validation
    const passwordRegex = /^(?=.*\d).{6,}$/;
    if (!passwordRegex.test(password)) {
      return errorResponse(400, 'Password must be at least 6 characters and include a number');
    }

    // ✅ Email and Phone validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{6,15}$/;

    if (email && !emailRegex.test(email)) {
      return errorResponse(400, 'Invalid email format');
    }

    if (phone && !phoneRegex.test(phone)) {
      return errorResponse(400, 'Phone number must be 6–15 digits');
    }

    const db = await connectDB();
    const users = db.collection('users');

    // ✅ Check for existing user
    const existingUser = await users.findOne({
      $or: [
        email ? { email: email.toLowerCase() } : null,
        phone ? { phone } : null,
      ].filter(Boolean), // remove null entries
    });

    if (existingUser) {
      return errorResponse(409, 'User with same email or phone already exists');
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      name: name.trim(),
      password: hashedPassword,
      createdAt: new Date(),
    };

    if (email) newUser.email = email.toLowerCase();
    if (phone) newUser.phone = phone;

    await users.insertOne(newUser);

    // ✅ Generate token
    const token = generateToken({
      email: email || '',
      phone: phone || '',
      name: name.trim(),
    });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        token,
        user: {
          name: name.trim(),
          email: email || null,
          phone: phone || null,
        },
      }),
    };
  } catch (error) {
    console.error('❌ Signup error:', error);
    return errorResponse(500, 'Signup failed', error.message);
  }
};

// ✅ Utility: CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

// ✅ Utility: Standard error response
function errorResponse(statusCode, message, error = null) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({
      success: false,
      message,
      ...(error && { error }),
    }),
  };
}



// // netlify/functions/signup.js
// const bcrypt = require('bcryptjs');
// const connectDB = require('./utils/db');
// const { generateToken } = require('./utils/auth');

// exports.handler = async (event) => {
//   if (event.httpMethod === 'OPTIONS') {
//     return {
//       statusCode: 200,
//       headers: corsHeaders(),
//       body: '',
//     };
//   }

//   if (event.httpMethod !== 'POST') {
//     return {
//       statusCode: 405,
//       headers: corsHeaders(),
//       body: JSON.stringify({ message: 'Method Not Allowed' }),
//     };
//   }

//   try {
//     const { name, email, password } = JSON.parse(event.body);

//     if (!email || !password || !name) {
//       return {
//         statusCode: 400,
//         headers: corsHeaders(),
//         body: JSON.stringify({ message: 'All fields are required' }),
//       };
//     }

//     const db = await connectDB();
//     const existing = await db.collection('users').findOne({ email });

//     if (existing) {
//       return {
//         statusCode: 409,
//         headers: corsHeaders(),
//         body: JSON.stringify({ message: 'User already exists' }),
//       };
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     await db.collection('users').insertOne({ name, email, password: hashedPassword });

//     const token = generateToken({ email, name });

//     return {
//       statusCode: 200,
//       headers: corsHeaders(),
//       body: JSON.stringify({ token, user: { name, email } }),
//     };
//   } catch (error) {
//     return {
//       statusCode: 500,
//       headers: corsHeaders(),
//       body: JSON.stringify({ message: 'Signup failed', error: error.message }),
//     };
//   }
// };

// function corsHeaders() {
//   return {
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Headers': 'Content-Type',
//     'Access-Control-Allow-Methods': 'POST, OPTIONS',
//     'Content-Type': 'application/json',
//   };
// }
