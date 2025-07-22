const bcrypt = require('bcryptjs');
const connectDB = require('./utils/db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, token, newPassword } = JSON.parse(event.body);

  if (!email || !token || !newPassword) {
    return { statusCode: 400, body: 'Missing fields' };
  }

  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email });

    if (
      !user ||
      user.resetToken !== token ||
      new Date(user.resetTokenExpiry) < new Date()
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid or expired token' }),
      };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.collection('users').updateOne(
      { email },
      {
        $set: { password: hashedPassword },
        $unset: { resetToken: '', resetTokenExpiry: '' },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Password reset successfully' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: err.message }),
    };
  }
};
