// netlify/functions/alipay-pay.js
const axios = require('axios');
const crypto = require('crypto');

// This function acts as your secure backend for creating an Alipay payment order.
// DO NOT expose private keys or secrets on the client-side.
exports.handler = async (event) => {
  // Check if the request method is POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  // Parse the request body
  const { amount, subject, out_trade_no } = JSON.parse(event.body);

  // --- IMPORTANT SECURITY NOTE ---
  // In a real application, you would use a proper Alipay SDK to handle
  // signing the request and generating the correct URL.
  // The code below is a simplified, non-secure example to illustrate the flow.
  // You would need to replace this with a secure SDK implementation.
  // Example SDK: `alipay-sdk` or `alipay-sdk-node` from npm.

  // Retrieve environment variables securely configured in Netlify.
  // The names of these variables should be the same as in your Netlify settings.
  const ALIPAY_APP_ID = process.env.ALIPAY_APP_ID;
  const ALIPAY_GATEWAY = process.env.ALIPAY_GATEWAY;
  const APP_PRIVATE_KEY = process.env.APP_PRIVATE_KEY; // This is highly sensitive!

  if (!ALIPAY_APP_ID || !ALIPAY_GATEWAY || !APP_PRIVATE_KEY) {
    console.error('Missing Alipay environment variables.');
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server configuration error.' }),
    };
  }
  
  // Placeholder for the business parameters required by Alipay
  const bizContent = {
    out_trade_no: out_trade_no, // Unique order number from your system
    total_amount: amount,
    subject: subject,
    product_code: 'QUICK_MSECURITY_PAY', // Payment product code
  };

  // Construct the parameters object for the API call
  const params = {
    app_id: ALIPAY_APP_ID,
    method: 'alipay.trade.app.pay',
    charset: 'utf-8',
    sign_type: 'RSA2', // Use RSA2 for better security
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
    // You would also add a notify_url and return_url here for webhooks
  };

  // --- Simplified Signature Generation (for demonstration ONLY) ---
  // A real SDK would handle this with proper cryptographic functions and
  // private keys. Do not do this manually in a production app.
  const signContent = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signContent);
  const sign = signer.sign(APP_PRIVATE_KEY, 'base64');
  params.sign = sign;

  // Build the final order string
  const orderString = Object.keys(params).map(key => {
    const value = params[key];
    return `${key}=${encodeURIComponent(value)}`;
  }).join('&');

  // Placeholder for the deep link URL. A real response would be
  // the order string that your React Native app can use to call Alipay.
  const deepLink = `alipays://platformapi/startapp?appId=20000067&${orderString}`;

  // You would typically make a POST request to the Alipay gateway here
  // and then return the deep link from the response. For this example,
  // we are generating the deep link directly to show the flow.
  try {
    // A mock API response
    // const apiResponse = await axios.post(ALIPAY_GATEWAY_URL, params);
    
    // Returning the generated deep link to the client
    return {
      statusCode: 200,
      body: JSON.stringify({ deepLink }),
    };
  } catch (error) {
    console.error('Error creating Alipay order:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to create Alipay order.' }),
    };
  }
};




// // netlify/functions/alipay-pay.js
// const { AlipaySdk } = require("alipay-sdk");

// const alipay = new AlipaySdk({
//   appId: process.env.ALIPAY_APP_ID,
//   privateKey: process.env.APP_PRIVATE_KEY, // ✅ PKCS#8 string with \n
//   alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
//   gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do",
//   signType: "RSA2",
// });

// // Helper: CORS wrapper
// function cors(body, status = 200, contentType = "application/json") {
//   return {
//     statusCode: status,
//     headers: {
//       "Access-Control-Allow-Origin": "*",
//       "Access-Control-Allow-Headers": "*",
//       "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
//       "Content-Type": contentType,
//     },
//     body: typeof body === "string" ? body : JSON.stringify(body),
//   };
// }

// exports.handler = async (event) => {
//   if (event.httpMethod === "OPTIONS") return cors("");

//   try {
//     const { amount = "9.99", subject = "Tarot Reading" } =
//       event.httpMethod === "POST"
//         ? JSON.parse(event.body || "{}")
//         : event.queryStringParameters || {};

//     const outTradeNo = `ORDER_${Date.now()}`;

//     const params = {
//       method: "alipay.trade.wap.pay",
//       return_url: 'https://successscreen.netlify.app/success.html',
//       notify_url: `${process.env.PUBLIC_BASE_URL}https://backend-tarot-app.netlify.app/.netlify/functions/alipay-notify`,
//       bizContent: {
//         out_trade_no: outTradeNo,
//         product_code: "QUICK_WAP_WAY",
//         total_amount: String(amount),
//         subject,
//         quit_url: `${process.env.PUBLIC_BASE_URL}/pay/cancel`,
//       },
//     };

//     let url;

//     // Try pageExecute first, fallback to exec
//     if (typeof alipay.pageExecute === "function") {
//       const r = await alipay.pageExecute(params, { method: "GET" });
//       url = typeof r === "string" ? r : r?.url;
//     } else {
//       const signedQuery = await alipay.exec("alipay.trade.wap.pay", params);
//       url = `${alipay.config.gateway}?${signedQuery}`;
//     }

//     if (!url) throw new Error("Failed to build Alipay URL");

//     return cors({ url, out_trade_no: outTradeNo });
//   } catch (err) {
//     console.error("❌ create-order error:", err);
//     return cors({ error: String(err?.message || err) }, 500);
//   }
// };
