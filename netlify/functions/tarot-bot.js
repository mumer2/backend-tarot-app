import { Groq } from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    const { prompt, system, lang = "en" } = body;

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing prompt" }),
      };
    }

    // Language-specific system prompt
    const defaultSystem = lang === "zh"
      ? "你是一位神秘的塔罗牌占卜师，用中文回答问题。风格要温柔、浪漫，带点神秘感，回复要简短但富有诗意。"
      : "You are a mystical tarot expert. Answer with poetic, magical, and short responses like a fortune teller.";

    const systemMessage = system || defaultSystem;

    const messages = [
      {
        role: "system",
        content: systemMessage,
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    const completion = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages,
      temperature: 0.7,
      max_tokens: 512,
    });

    const reply = completion.choices[0]?.message?.content?.trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    };
  } catch (error) {
    console.error("Error in tarot-bot:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal error" }),
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
