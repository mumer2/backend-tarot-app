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

    if (!name || !password || (!email && !phone)) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({
          message: 'Name, password, and either email or phone are required',
        }),
      };
    }

    const db = await connectDB();
    const users = db.collection('users');

    // Check if user already exists by email or phone
    const existingUser = await users.findOne({
      $or: [
        email ? { email: email.toLowerCase() } : {},
        phone ? { phone } : {},
      ],
    });

    if (existingUser) {
      return {
        statusCode: 409,
        headers: corsHeaders(),
        body: JSON.stringify({
          message: 'User with same email or phone already exists',
        }),
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      name,
      password: hashedPassword,
      createdAt: new Date(),
    };

    if (email) newUser.email = email.toLowerCase();
    if (phone) newUser.phone = phone;

    await users.insertOne(newUser);

    const token = generateToken({
      email: email || '',
      phone: phone || '',
      name,
    });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        token,
        user: { name, email: email || null, phone: phone || null },
      }),
    };
  } catch (error) {
    console.error('Signup error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        message: 'Signup failed',
        error: error.message,
      }),
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
