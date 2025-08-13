// netlify/functions/horoscope.js
const axios = require('axios');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { sign, period } = JSON.parse(event.body);

    if (!sign || !period) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing sign or period in request body' }),
      };
    }

    const GROK_API_KEY = process.env.GROQ_API_KEY;

    if (!GROK_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GROK_API_KEY not configured' }),
      };
    }

        const prompt = `Write a detailed ${period} horoscope for the zodiac sign ${sign}, including the date or date range at the top.`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data.choices?.[0]?.message?.content?.trim() || '';

    return {
      statusCode: 200,
      body: JSON.stringify({ horoscope: text }),
    };
  } catch (error) {
    console.error('Grok API error:', error.message || error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch horoscope' }),
    };
  }
};
