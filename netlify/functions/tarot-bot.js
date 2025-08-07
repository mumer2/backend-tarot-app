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

  const { prompt, system, language } = body;
  if (!prompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing prompt" }),
    };
  }

  // Define the system prompt based on the provided 'system' parameter or use a default.
  // This allows the frontend to control the bot's persona.
  const finalSystemPrompt = system || "You are a mystical tarot expert. Answer with poetic, magical, and short responses like a fortune teller.";

  // Define a mapping of system prompts for different languages if not provided by the client.
  // This is the key part for multilingual support.
  const languagePrompts = {
    "en": "Respond in English.",
    "zh": "请用中文回复。", // Respond in Chinese.
    // Add other languages here as needed
  };

  // Construct the full system message, combining the persona and the language instruction.
  const languageInstruction = languagePrompts[language] || languagePrompts["en"];
  const fullSystemContent = `${finalSystemPrompt} ${languageInstruction}`;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: fullSystemContent,
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
