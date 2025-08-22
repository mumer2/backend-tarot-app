// netlify/functions/alipay-pay.js
const { AlipaySdk } = require("alipay-sdk");

// Initialize Alipay SDK
const alipay = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.APP_PRIVATE_KEY, // PKCS#8 string with \n
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
  gateway: "https://openapi.alipaydev.com/gateway.do",
  signType: "RSA2",
});

// Helper: CORS wrapper
function cors(body, status = 200, contentType = "application/json") {
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Content-Type": contentType,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors("");

  try {
    const { amount = "9.99", subject = "Tarot Reading", userId } =
      event.httpMethod === "POST"
        ? JSON.parse(event.body || "{}")
        : event.queryStringParameters || {};

    if (!userId) return cors({ error: "Missing userId" }, 400);

    const outTradeNo = `ORDER_${Date.now()}`;

    // Set dynamic expiration 30 minutes from now
    const expireDate = new Date(Date.now() + 30 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // WAP payment parameters
    const params = {
      method: "alipay.trade.wap.pay",
      bizContent: {
        out_trade_no: outTradeNo,
        product_code: "QUICK_WAP_WAY",
        total_amount: String(amount),
        subject,
        quit_url: "https://successscreen.netlify.app/cancel.html",
        time_expire: expireDate,
        passback_params: encodeURIComponent(userId),
      },
    };

    // Generate payment URL
    const url = await alipay.exec("alipay.trade.wap.pay", params, {
      method: "GET",
      return_url: "https://successscreen.netlify.app/success.html",
      notify_url:
        "https://backend-tarot-app.netlify.app/.netlify/functions/alipay-notify",
    });

    // Detect if Alipay returned HTML instead of a URL (permission issue)
    if (!url || url.startsWith("<!DOCTYPE")) {
      throw new Error(
        "Alipay returned HTML instead of a payment URL. Check app permissions and credentials."
      );
    }

    return cors({ url, out_trade_no: outTradeNo });
  } catch (err) {
    console.error("❌ create-order error:", err);
    return cors({ error: String(err?.message || err) }, 500);
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
