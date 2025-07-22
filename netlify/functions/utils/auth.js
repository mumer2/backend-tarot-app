// netlify/functions/utils/auth.js
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'your-secret-key';

function generateToken(payload) {
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

module.exports = { generateToken };
