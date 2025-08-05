const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
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
    const { name, email, phone, password, referralCode } = JSON.parse(event.body);

    if (!name || !password || (!email && !phone)) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'Name, password, and email or phone are required' }),
      };
    }

    const db = await connectDB();
    const query = email ? { email } : { phone };
    const existingUser = await db.collection('users').findOne(query);

    if (existingUser) {
      return {
        statusCode: 409,
        headers: corsHeaders(),
        body: JSON.stringify({ message: 'User already exists' }),
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const points = 50;
    const myReferralCode = generateReferralCode(name);

    let referredBy = null;
    let referrerId = null;

    // Handle referral reward logic
    if (referralCode) {
      const referrer = await db.collection('users').findOne({ referralCode });

      if (referrer) {
        referredBy = referrer.name;
        referrerId = referrer._id;

        // Add referral bonus to referrer
        await db.collection('users').updateOne(
          { _id: referrer._id },
          { $inc: { points: 50 } }
        );
      }
    }

    // Create new user
    const newUser = {
      _id: userId,
      name,
      email: email || null,
      phone: phone || null,
      password: hashedPassword,
      points,
      referralCode: myReferralCode, // ✅ Generated for every user
      referredBy,                   // ✅ Name of referrer, if any
      referrerId,                   // Optional internal ID
      createdAt: new Date(),
    };

    await db.collection('users').insertOne(newUser);

    const token = generateToken({ userId, email, phone });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        token,
        userId,
        name,
        points,
        referralCode: myReferralCode,
        referredBy: referredBy || null,
      }),
    };
  } catch (error) {
    console.error('Signup error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ message: 'Signup failed', error: error.message }),
    };
  }
};

function generateReferralCode(name) {
  return (
    name.toLowerCase().replace(/\s+/g, '').substring(0, 4) +
    Math.floor(1000 + Math.random() * 9000)
  );
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}



// const bcrypt = require('bcryptjs');
// const { v4: uuidv4 } = require('uuid');
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
//     const { name, email, phone, password, referralCode } = JSON.parse(event.body);

//     if (!name || !password || (!email && !phone)) {
//       return {
//         statusCode: 400,
//         headers: corsHeaders(),
//         body: JSON.stringify({ message: 'Name, password, and email or phone are required' }),
//       };
//     }

//     const db = await connectDB();

//     const query = email ? { email } : { phone };
//     const existingUser = await db.collection('users').findOne(query);

//     if (existingUser) {
//       return {
//         statusCode: 409,
//         headers: corsHeaders(),
//         body: JSON.stringify({ message: 'User already exists' }),
//       };
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const userId = uuidv4();
//     const points = 50;

//     const newUser = {
//       _id: userId,
//       name,
//       email: email || null,
//       phone: phone || null,
//       password: hashedPassword,
//       points,
//       referralCode: generateReferralCode(name),
//       createdAt: new Date(),
//     };

//     if (referralCode) {
//       newUser.referredBy = referralCode;
//       // Optional: increase referrer's points
//       await db.collection('users').updateOne(
//         { referralCode },
//         { $inc: { points: 20 } }
//       );
//     }

//     await db.collection('users').insertOne(newUser);
//     const token = generateToken({ userId, email, phone });

//     return {
//       statusCode: 200,
//       headers: corsHeaders(),
//       body: JSON.stringify({
//         success: true,
//         token,
//         userId,
//         name, // <-- Add this line
//         points,
//         referralCode: newUser.referralCode,
//       }),
//     };
//   } catch (error) {
//     return {
//       statusCode: 500,
//       headers: corsHeaders(),
//       body: JSON.stringify({ message: 'Signup failed', error: error.message }),
//     };
//   }
// };

// function generateReferralCode(name) {
//   return name.toLowerCase().replace(/\s+/g, '').substring(0, 4) + Math.floor(1000 + Math.random() * 9000);
// }

// function corsHeaders() {
//   return {
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Headers': 'Content-Type',
//     'Access-Control-Allow-Methods': 'POST, OPTIONS',
//     'Content-Type': 'application/json',
//   };
// }




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
