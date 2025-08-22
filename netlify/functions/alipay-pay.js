// netlify/functions/alipay-pay.js
const { AlipaySdk } = require("alipay-sdk");
const qs = require("qs");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { amount, userId } = JSON.parse(event.body);

    if (!amount || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing amount or userId" }) };
    }

    const alipaySdk = new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, "\n"),
      signType: "RSA2",
      timeout: 30000,
      gateway: process.env.ALIPAY_SANDBOX === "true"
        ? "https://openapi.alipaydev.com/gateway.do" // Sandbox
        : "https://openapi.alipay.com/gateway.do",    // Production
    });

    const orderId = "order_" + Date.now();

    // Create Alipay app order string
    const orderString = await alipaySdk.exec("alipay.trade.app.pay", {
      bizContent: {
        subject: "Tarot Coins Recharge",
        out_trade_no: orderId,
        total_amount: amount.toFixed(2),
        product_code: "QUICK_MSECURITY_PAY",
        passback_params: encodeURIComponent(userId),
      },
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || "https://backend-tarot-app.netlify.app/.netlify/functions/alipay-notify",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ orderString, orderId }),
    };
  } catch (err) {
    console.error("Alipay Pay Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message, stack: err.stack }),
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
