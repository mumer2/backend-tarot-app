// netlify/functions/requestReset.js
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGO_URI);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Email is required' }),
      };
    }

    await client.connect();
    const db = client.db('tarot-station');
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, message: 'User not found' }),
      };
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();

    await db.collection('reset_tokens').insertOne({
      email,
      token,
      createdAt: new Date(),
    });

    await transporter.sendMail({
      from: `"Tarot Station" <${process.env.EMAIL_USER}>`, // ✅ Sender name here
      to: email,
      subject: '🔐 Password Reset Code',
      html: `<p>Your password reset code is: <strong>${token}</strong></p>`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Email sent',
        token,      // ✅ Return token in response
        email,      // ✅ Also return email for convenience
      }),
    };
  } catch (err) {
    console.error('Reset error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Server error',
        error: err.message,
      }),
    };
  }
};
