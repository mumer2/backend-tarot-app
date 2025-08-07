const axios = require("axios");

exports.handler = async function (event) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error("❌ Missing GROQ_API_KEY");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing GROQ_API_KEY" }),
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

  const { prompt, lang, system } = body;

  if (!prompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing prompt" }),
    };
  }

  // Language-based system messages
  const systemMessageMap = {
    en: "You are a mystical tarot expert. Answer with poetic, magical, and short responses like a fortune teller.",
    zh: "你是一位神秘的塔罗专家。用诗意、神秘且简短的语言像占卜师一样回答问题，请始终用中文回答。",
  };

  const systemMessage =
    system || systemMessageMap[lang] || systemMessageMap["en"];

  console.log("🔮 Incoming prompt:", prompt);
  console.log("🌐 Language:", lang);
  console.log("🧙 System Message:", systemMessage);

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: systemMessage,
          },
          {
            role: "user",
            content: prompt,
          },
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
