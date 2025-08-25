const { AlipaySdk } = require("alipay-sdk");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config();

let cachedDb = null;
const connectToDatabase = async (uri) => {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  cachedDb = client.db("tarot-station");
  return cachedDb;
};

const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, "\n"),
  gateway: "https://openapi.alipay.com/gateway.do", // production
  signType: "RSA2",
});

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
    const { amount = "9.99", subject = "Tarot Recharge", userId } =
      event.httpMethod === "POST"
        ? JSON.parse(event.body || "{}")
        : event.queryStringParameters || {};

    if (!userId) {
      return cors({ error: "Missing userId" }, 400);
    }

    const outTradeNo = `ORDER_${Date.now()}_${userId}`;

    const params = {
      subject,
      out_trade_no: outTradeNo,
      total_amount: String(amount),
      product_code: "QUICK_WAP_WAY",
      quit_url: process.env.ALIPAY_RETURN_URL || "https://yourapp.com/recharge",
      passback_params: userId, // ✅ userId will be returned in notify
    };

    // Get HTML form for WAP payment
    const html = await alipaySdk.pageExecute("alipay.trade.wap.pay", params, {
      notifyUrl: process.env.ALIPAY_NOTIFY_URL,
      returnUrl: process.env.ALIPAY_RETURN_URL,
    });

    if (!html) throw new Error("Failed to build Alipay HTML form");

    // ✅ Save a pending record in DB
    const db = await connectToDatabase(process.env.MONGO_URI);
    const recharges = db.collection("wallet_history");

    await recharges.insertOne({
      userId,
      amount: parseFloat(amount),
      method: "Alipay",
      timestamp: new Date(),
      orderId: outTradeNo,
      status: "pending",
    });

    console.log(`✅ Alipay order created for ${userId}: ${outTradeNo}`);

    return cors({ url: html, out_trade_no: outTradeNo });
  } catch (error) {
    console.error("Alipay Pay Error:", error);
    return cors({ error: error.message, stack: error.stack }, 500);
  }
};




// const { AlipaySdk } = require("alipay-sdk");
// const dotenv = require("dotenv");

// dotenv.config();

// const alipaySdk = new AlipaySdk({
//   appId: process.env.ALIPAY_APP_ID,
//   privateKey: process.env.APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
//   alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
//   gateway: 'https://openapi.alipay.com/gateway.do', // sandbox
//   signType: 'RSA2',
// });

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
//     const { amount = "9.99", subject = "Tarot Recharge", userId } =
//       event.httpMethod === "POST"
//         ? JSON.parse(event.body || "{}")
//         : event.queryStringParameters || {};

//     const outTradeNo = `ORDER_${Date.now()}_${userId || "guest"}`;

//     const params = {
//       subject,
//       out_trade_no: outTradeNo,
//       total_amount: String(amount),
//       product_code: "QUICK_WAP_WAY",
//       quit_url: process.env.ALIPAY_RETURN_URL || "https://yourapp.com/recharge",
//     };

//     // Get HTML form for WAP payment
//     const html = await alipaySdk.pageExecute("alipay.trade.wap.pay", params, {
//       notifyUrl: process.env.ALIPAY_NOTIFY_URL,
//       returnUrl: process.env.ALIPAY_RETURN_URL,
//     });

//     console.log("Alipay pageExecute result:", html);

//     if (!html) {
//       throw new Error("Failed to build Alipay HTML form");
//     }

//     return cors({ url: html, out_trade_no: outTradeNo });
//   } catch (error) {
//     console.error("Alipay Pay Error:", error);
//     return cors({ error: error.message, stack: error.stack }, 500);
//   }
// };


