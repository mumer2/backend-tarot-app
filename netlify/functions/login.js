const bcrypt = require('bcryptjs');
const connectDB = require('./utils/db');
const { generateToken } = require('./utils/auth');
const { ObjectId } = require('mongodb');

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
    const body = JSON.parse(event.body);
    const password = body.password;
    const rawInput = body.email || body.phone;

    if (!rawInput || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Email or phone and password are required' }),
      };
    }

    const input = rawInput.trim();
    const db = await connectDB();
    const users = db.collection('users');

    // Detect email or phone format
    let query = {};
    if (/^\d{10,15}$/.test(input)) {
      query = { phone: input };
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
      query = { email: input.toLowerCase() };
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Invalid email or phone format' }),
      };
    }

    const user = await users.findOne(query);

    if (!user || !(await bcrypt.compare(password, user.password || user.passwordHash))) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Invalid credentials' }),
      };
    }

    // Generate JWT
    const token = generateToken({
      id: user._id,
      email: user.email || '',
      phone: user.phone || '',
      name: user.name,
    });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        token,
        user: {
          _id: user._id.toString(),
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          profilePic: user.profilePic || '',
          balance: user.balance || 0,
          createdAt: user.createdAt || null,
        },
      }),
    };
  } catch (err) {
    console.error('❌ Login error:', err);
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
//     const body = JSON.parse(event.body);
//     const password = body.password;
//     const rawInput = body.email || body.phone;

//     if (!rawInput || !password) {
//       return {
//         statusCode: 400,
//         headers: corsHeaders(),
//         body: JSON.stringify({ message: 'Email or phone and password are required' }),
//       };
//     }

//     const input = rawInput.trim();
//     const db = await connectDB();
//     const users = db.collection('users');

//     // Detect whether input is a phone number or an email
//     let query = {};
//     if (/^\d{10,15}$/.test(input)) {
//       query = { phone: input };
//     } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
//       query = { email: input.toLowerCase() };
//     } else {
//       return {
//         statusCode: 400,
//         headers: corsHeaders(),
//         body: JSON.stringify({ message: 'Invalid email or phone format' }),
//       };
//     }

//     const user = await users.findOne(query);

//     if (!user || !(await bcrypt.compare(password, user.password || user.passwordHash))) {
//       return {
//         statusCode: 401,
//         headers: corsHeaders(),
//         body: JSON.stringify({ message: 'Invalid credentials' }),
//       };
//     }

//     const token = generateToken({
//       id: user._id,
//       email: user.email || '',
//       phone: user.phone || '',
//       name: user.name,
//     });

//     return {
//       statusCode: 200,
//       headers: corsHeaders(),
//       body: JSON.stringify({
//         token,
//         user: {
//           _id: user._id,
//           name: user.name,
//           email: user.email || '',
//           phone: user.phone || '',
//           balance: user.balance || 0,
//         },
//       }),
//     };
//   } catch (err) {
//     console.error('❌ Login error:', err);
//     return {
//       statusCode: 500,
//       headers: corsHeaders(),
//       body: JSON.stringify({ message: 'Login failed', error: err.message }),
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




// // netlify/functions/login.js
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
//     const { email, password } = JSON.parse(event.body);

//     if (!email || !password) {
//       return {
//         statusCode: 400,
//         headers: corsHeaders(),
//         body: JSON.stringify({ message: 'Email and password required' }),
//       };
//     }

//     const db = await connectDB();
//     const user = await db.collection('users').findOne({ email });

//     if (!user || !(await bcrypt.compare(password, user.password))) {
//       return {
//         statusCode: 401,
//         headers: corsHeaders(),
//         body: JSON.stringify({ message: 'Invalid email or password' }),
//       };
//     }

//     const token = generateToken({ email: user.email, name: user.name });

//     return {
//       statusCode: 200,
//       headers: corsHeaders(),
//       body: JSON.stringify({
//         token,
//         user: {
//           _id: user._id,                // ✅ include MongoDB ID
//           email: user.email,
//           name: user.name,
//           balance: user.balance || 0,   // ✅ optional: return wallet balance
//         },
//       }),
//     };
//   } catch (err) {
//     return {
//       statusCode: 500,
//       headers: corsHeaders(),
//       body: JSON.stringify({ message: 'Login failed', error: err.message }),
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
