const axios = require("axios");

exports.handler = async function (event) {
  console.log("📥 event.body:", event.body);

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Only POST allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { question, system, lang } = body;
  console.log("Parsed:", { question, system, lang });

  if (!question) {
    return { statusCode: 400, body: JSON.stringify({ error: "Question is required" }) };
  }

  const localizedPrompt = lang === "zh"
    ? `你是一个神秘的塔罗占卜师，请用中文回答以下问题：${question}`
    : `You are a mystical tarot expert. Please answer in English only: ${question}`;

  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: localizedPrompt });

  try {
    const resp = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      { model: "llama3-8b-8192", messages, temperature: 0.7 },
      { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" } }
    );

    const answer = resp.data.choices?.[0]?.message?.content?.trim() || "";
    return { statusCode: 200, body: JSON.stringify({ answer }) };
  } catch (err) {
    console.error("❌ Groq error:", err.response?.data || err.message);
    return { statusCode: 500, body: JSON.stringify({ error: "Groq request failed", details: err.response?.data || err.message }) };
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
