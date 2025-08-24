// netlify/functions/create-alipay-order.js
const AlipaySdk = require("alipay-sdk").default;
const qs = require("qs");

const sdk = new AlipaySdk({
  appId: process.env.ALIPAY_APPID,
  privateKey: process.env.APP_PRIVATE_KEY,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
  gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipaydev.com/gateway.do",
  signType: "RSA2",
  timeout: 5000
});

/**
 * Body JSON you can send from the app:
 * { amount: "10.00", subject: "Tarot Recharge", outTradeNo: "your-id-123" }
 * If omitted, defaults are used.
 */
exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const totalAmount = String(body.amount || "10.00"); // Yuan
    const subject = body.subject || "Test Order";
    const outTradeNo = body.outTradeNo || String(Date.now());
    const returnUrl = process.env.RETURN_URL;
    const notifyUrl = process.env.NOTIFY_URL;

    // Build WAP Pay (H5) request
    const params = {
      bizContent: {
        out_trade_no: outTradeNo,
        product_code: "QUICK_WAP_WAY",
        total_amount: totalAmount,
        subject
      },
      return_url: returnUrl,
      notify_url: notifyUrl
    };

    /**
     * IMPORTANT:
     * - For H5/WAP/web payments, use pageExecute/pageExec.
     * - It returns an HTML <form> string by default OR a full redirect URL depending on version/opts.
     */
    const htmlOrUrl = await sdk.pageExecute("alipay.trade.wap.pay", params, { method: "GET" });

    // Normalize response for the app:
    // If it looks like HTML form, send "html"; else treat it as a URL.
    const isHtml = typeof htmlOrUrl === "string" && /^</.test(htmlOrUrl.trim());

    // CORS headers so you can call from your Expo app directly
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...cors },
      body: JSON.stringify({
        type: isHtml ? "html" : "url",
        data: htmlOrUrl,
        outTradeNo
      })
    };
  } catch (error) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...cors },
      body: JSON.stringify({ error: error.message })
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
