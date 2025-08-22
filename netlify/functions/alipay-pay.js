// netlify/functions/alipay-create.js
const { MongoClient } = require("mongodb");
const { nanoid } = require("nanoid");
const AlipaySdk = require("alipay-sdk").default;

const appId = process.env.ALIPAY_APP_ID;
const privateKey = process.env.APP_PRIVATE_KEY;
const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
const gateway = process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do";
const baseUrl = process.env.APP_BASE_URL; // e.g. https://your-site.netlify.app
const mongoUri = process.env.MONGO_URI;
const mongoDbName = "tarot-station";

let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  cachedDb = client.db(mongoDbName);
  return cachedDb;
}

const alipay = new AlipaySdk({
  appId,
  privateKey,
  alipayPublicKey,
  gateway,
  signType: "RSA2",
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { amount, subject, userId, passback_params } = body;

    if (!amount || !subject || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "amount, subject and userId are required" }) };
    }

    // Unique order number
    const outTradeNo = `ORD_${userId}_${nanoid(10)}`;

    // Callback URLs
    const return_url = `${baseUrl}/alipay-return`;
    const notify_url = `https://backend-tarot-app.netlify.app/.netlify/functions/alipay-notify`;

    // Save order in DB
    const db = await connectToDatabase();
    await db.collection("orders").insertOne({
      outTradeNo,
      amount: String(amount),
      subject,
      userId,
      status: "PENDING",
      createdAt: new Date(),
      passback_params: passback_params || null,
    });

    // Biz content
    const bizContent = {
      out_trade_no: outTradeNo,
      total_amount: String(amount),
      subject,
      product_code: "QUICK_WAP_WAY",
    };

    if (passback_params) {
      bizContent.passback_params = encodeURIComponent(passback_params);
    }

    // Prepare formData
    const formData = new alipay.FormData();
    formData.setMethod("get");
    formData.addField("returnUrl", return_url);
    formData.addField("notifyUrl", notify_url);
    formData.addField("bizContent", bizContent);

    const paymentUrl = await alipay.exec("alipay.trade.wap.pay", {}, { formData });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentUrl, outTradeNo }),
    };
  } catch (err) {
    console.error("alipay-create error:", err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: "Server Error", details: err.message }) };
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
