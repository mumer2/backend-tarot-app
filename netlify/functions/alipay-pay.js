// netlify/functions/alipay-pay.js
import AlipaySdk from 'alipay-sdk';
import crypto from 'crypto';

// ✅ Initialize Alipay
const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APPID,
  privateKey: process.env.APP_PRIVATE_KEY.replace(/\\n/g, '\n'), // handle env formatting
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
  gateway: 'https://openapi.alipaydev.com/gateway.do', // sandbox
  signType: 'RSA2',
});

// ✅ Netlify Lambda handler
export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { outTradeNo, subject, totalAmount, productCode } = body;

    // Example payment request
    const result = await alipaySdk.exec('alipay.trade.wap.pay', {
      bizContent: {
        out_trade_no: outTradeNo || 'ORDER_' + Date.now(),
        subject: subject || 'Test Order',
        total_amount: totalAmount || '0.01',
        product_code: productCode || 'QUICK_WAP_WAY',
      },
      return_url: process.env.ALIPAY_RETURN_URL, // redirect back after payment
      notify_url: process.env.ALIPAY_NOTIFY_URL, // async callback
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, result }),
    };
  } catch (error) {
    console.error('Alipay Pay Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
}














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
