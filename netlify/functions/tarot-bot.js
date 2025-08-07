const axios = require("axios");

exports.handler = async function (event) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error("❌ GROQ_API_KEY is missing in environment variables.");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing GROQ_API_KEY in environment" }),
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Only POST method allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { prompt, lang } = body;
  if (!prompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing prompt" }),
    };
  }

  // Prepend language-specific instruction
  const localizedPrompt =
    lang === "zh"
      ? `你是一个神秘的塔罗牌大师，请用诗意、魔法和简短的语言来回答：${prompt}`
      : `You are a mystical tarot expert. Answer with poetic, magical, and short responses like a fortune teller. ${prompt}`;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages: [
          { role: "user", content: localizedPrompt }
        ],
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const answer = response.data.choices?.[0]?.message?.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: answer || "✨ The spirits are quiet..." }),
    };
  } catch (error) {
    console.error("❌ Groq API error:", error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Groq request failed",
        details: error.response?.data || error.message,
      }),
    };
  }
};


// const axios = require("axios");

// exports.handler = async function (event) {
//   const apiKey = process.env.GROQ_API_KEY;

//   if (!apiKey) {
//     console.error("❌ Missing GROQ_API_KEY");
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: "Missing GROQ_API_KEY" }),
//     };
//   }

//   if (event.httpMethod !== "POST") {
//     return {
//       statusCode: 405,
//       body: JSON.stringify({ error: "Only POST method allowed" }),
//     };
//   }

//   let body;
//   try {
//     body = JSON.parse(event.body);
//   } catch {
//     return {
//       statusCode: 400,
//       body: JSON.stringify({ error: "Invalid JSON" }),
//     };
//   }

//   const { prompt } = body;
//   if (!prompt) {
//     return {
//       statusCode: 400,
//       body: JSON.stringify({ error: "Missing prompt" }),
//     };
//   }

//   try {
//     const response = await axios.post(
//       "https://api.groq.com/openai/v1/chat/completions",
//       {
//         model: "llama3-8b-8192",
//         messages: [
//           {
//             role: "system",
//             content: "You are a mystical tarot expert. Answer with poetic, magical, and short responses like a fortune teller.",
//           },
//           {
//             role: "user",
//             content: prompt,
//           },
//         ],
//         temperature: 0.8,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${apiKey}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const answer = response.data.choices?.[0]?.message?.content;

//     return {
//       statusCode: 200,
//       body: JSON.stringify({ reply: answer || "✨ The spirits are quiet..." }),
//     };
//   } catch (error) {
//     console.error("❌ Groq API error:", error.response?.data || error.message);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({
//         error: "Groq request failed",
//         details: error.response?.data || error.message,
//       }),
//     };
//   }
// };
