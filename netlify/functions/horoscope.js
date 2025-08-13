const axios = require('axios');
const dayjs = require('dayjs');

const luckyData = {
  Aries: { color: 'Red', number: 9 },
  Taurus: { color: 'Green', number: 6 },
  Gemini: { color: 'Yellow', number: 5 },
  Cancer: { color: 'White', number: 2 },
  Leo: { color: 'Orange', number: 1 },
  Virgo: { color: 'Brown', number: 5 },
  Libra: { color: 'Pink', number: 6 },
  Scorpio: { color: 'Black', number: 9 },
  Sagittarius: { color: 'Purple', number: 3 },
  Capricorn: { color: 'Gray', number: 8 },
  Aquarius: { color: 'Blue', number: 4 },
  Pisces: { color: 'Sea Green', number: 7 },
};

const getDateRangeText = (period) => {
  const today = dayjs();

  if (period === 'daily') {
    return today.format('MMMM D, YYYY'); // August 13, 2025
  }

  if (period === 'weekly') {
    const start = today.startOf('week');
    const end = today.endOf('week');
    return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
  }

  if (period === 'monthly') {
    return today.format('MMMM YYYY'); // August 2025
  }

  return '';
};

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { sign, period, language } = JSON.parse(event.body);

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

    // Default to English if language not provided or not supported
    const lang = (language && ['en', 'zh'].includes(language.toLowerCase())) ? language.toLowerCase() : 'en';

    // Modify prompt based on language
    let prompt = `Write a detailed ${period} horoscope for the zodiac sign ${sign}. Do not include dates or lucky numbers/colors in your response.`;

    if (lang === 'zh') {
      prompt += ' 请用中文写这段运势。'; // "Please write this horoscope in Chinese."
    } else if (lang === 'en') {
      // English - no change needed
    } else {
      // For other languages, you can add conditions here if needed
    }

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

    const horoscopeText = response.data.choices?.[0]?.message?.content?.trim() || '';

    const dateRange = getDateRangeText(period);
    const lucky = luckyData[sign] || { color: 'N/A', number: 'N/A' };

    return {
      statusCode: 200,
      body: JSON.stringify({
        horoscope: horoscopeText,
        dateRange,
        luckyColor: lucky.color,
        luckyNumber: lucky.number,
      }),
    };
  } catch (error) {
    console.error('Grok API error:', error.message || error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch horoscope' }),
    };
  }
};



// // netlify/functions/horoscope.js
// const axios = require('axios');

// exports.handler = async function(event, context) {
//   if (event.httpMethod !== 'POST') {
//     return {
//       statusCode: 405,
//       body: JSON.stringify({ error: 'Method Not Allowed' }),
//     };
//   }

//   try {
//     const { sign, period } = JSON.parse(event.body);

//     if (!sign || !period) {
//       return {
//         statusCode: 400,
//         body: JSON.stringify({ error: 'Missing sign or period in request body' }),
//       };
//     }

//     const GROK_API_KEY = process.env.GROQ_API_KEY;

//     if (!GROK_API_KEY) {
//       return {
//         statusCode: 500,
//         body: JSON.stringify({ error: 'GROK_API_KEY not configured' }),
//       };
//     }

//         const prompt = `Write a detailed ${period} horoscope for the zodiac sign ${sign}, including the date or date range at the top.`;

//     const response = await axios.post(
//       'https://api.groq.com/openai/v1/chat/completions',
//       {
//         model: 'llama3-8b-8192',
//         messages: [{ role: 'user', content: prompt }],
//         max_tokens: 500,
//         temperature: 0.7,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${GROK_API_KEY}`,
//           'Content-Type': 'application/json',
//         },
//       }
//     );

//     const text = response.data.choices?.[0]?.message?.content?.trim() || '';

//     return {
//       statusCode: 200,
//       body: JSON.stringify({ horoscope: text }),
//     };
//   } catch (error) {
//     console.error('Grok API error:', error.message || error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: 'Failed to fetch horoscope' }),
//     };
//   }
// };
