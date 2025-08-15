// netlify/functions/wechat-notify.js
const crypto = require("crypto");
const xml2js = require("xml2js");
const { MongoClient } = require("mongodb");

const { MONGO_URI, WECHAT_API_KEY } = process.env;

if (!MONGO_URI || !WECHAT_API_KEY) {
  console.error("❌ Missing env vars: MONGO_URI or WECHAT_API_KEY");
}

// ---- Mongo connection reuse ----
let cachedDb = null;
let cachedClient = null;
async function connectDB() {
  if (cachedDb && cachedClient) return cachedDb;
  cachedClient = new MongoClient(MONGO_URI, { maxPoolSize: 5 });
  await cachedClient.connect();
  cachedDb = cachedClient.db("tarot-station");
  return cachedDb;
}

// ---- Build XML response for WeChat ----
function buildXml(obj) {
  const builder = new xml2js.Builder({
    rootName: "xml",
    headless: true,
    cdata: true,
    renderOpts: { pretty: false },
  });
  return builder.buildObject(obj);
}

// ---- Generate WeChat-style signature ----
function generateSign(params) {
  const stringA = Object.keys(params)
    .filter((key) => key !== "sign" && params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const stringSignTemp = `${stringA}&key=${WECHAT_API_KEY}`;
  return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
}

// ---- Main handler ----
exports.handler = async (event) => {
  try {
    if (event.httpMethod && event.httpMethod !== "POST") {
      return { statusCode: 405, body: buildXml({ return_code: "FAIL", return_msg: "Method Not Allowed" }) };
    }

    const rawXml = event.body;
    if (!rawXml) {
      return { statusCode: 400, body: buildXml({ return_code: "FAIL", return_msg: "Empty body" }) };
    }

    const parsed = await xml2js.parseStringPromise(rawXml, {
      explicitArray: false,
      trim: true,
    });
    const data = parsed?.xml || {};

    console.log("📩 WeChat Notify Received:", {
      out_trade_no: data.out_trade_no,
      return_code: data.return_code,
      result_code: data.result_code,
      total_fee: data.total_fee,
    });

    // ---- Signature check ----
    const receivedSign = data.sign;
    const calculatedSign = generateSign(data);
    if (receivedSign !== calculatedSign) {
      console.warn("⚠️ Invalid signature from WeChat");
      return {
        statusCode: 200,
        body: buildXml({ return_code: "FAIL", return_msg: "Invalid signature" }),
      };
    }

    // ---- Payment success ----
    if (data.return_code === "SUCCESS" && data.result_code === "SUCCESS") {
      const out_trade_no = data.out_trade_no;
      const total_fee_rmb = parseFloat(data.total_fee) / 100; // fen → RMB

      const db = await connectDB();
      const ordersCol = db.collection("wechat_orders");
      const walletsCol = db.collection("wallets");

      const order = await ordersCol.findOne({ out_trade_no });
      if (!order) {
        console.warn("⚠️ Order not found in DB:", out_trade_no);
        return {
          statusCode: 200,
          body: buildXml({ return_code: "FAIL", return_msg: "Order not found" }),
        };
      }

      if (order.status === "PAID") {
        console.log("ℹ️ Order already marked as PAID:", out_trade_no);
        return {
          statusCode: 200,
          body: buildXml({ return_code: "SUCCESS", return_msg: "OK" }),
        };
      }

      // ---- Update wallet safely (increment balance) ----
      await walletsCol.updateOne(
        { userId: order.userId },
        { $inc: { balance: total_fee_rmb } },
        { upsert: true }
      );

      // ---- Update order status ----
      await ordersCol.updateOne(
        { out_trade_no },
        {
          $set: {
            status: "PAID",
            paidAt: new Date(),
            paymentProvider: "wechat_h5",
            wechatTransactionId: data.transaction_id || null,
          },
        }
      );

      console.log(`✅ Wallet updated for ${order.userId} → +${total_fee_rmb} RMB`);
      return { statusCode: 200, body: buildXml({ return_code: "SUCCESS", return_msg: "OK" }) };
    }

    // ---- Payment failed ----
    console.warn("❌ Payment failed:", data.err_code_des || "Unknown reason");
    return {
      statusCode: 200,
      body: buildXml({ return_code: "FAIL", return_msg: data.err_code_des || "Payment failed" }),
    };
  } catch (err) {
    console.error("❌ Notify handler error:", err?.message || err);
    return {
      statusCode: 500,
      body: buildXml({ return_code: "FAIL", return_msg: "Internal Error" }),
    };
  }
};



// const crypto = require("crypto");
// const xml2js = require("xml2js");
// const { MongoClient } = require("mongodb");

// const MONGO_URI = process.env.MONGO_URI;
// const WECHAT_API_KEY = process.env.WECHAT_API_KEY;

// const connectDB = async () => {
//   const client = new MongoClient(MONGO_URI);
//   await client.connect();
//   return client.db("tarot-station");
// };

// // Helper to build XML response for WeChat
// const buildXml = (obj) => {
//   const builder = new xml2js.Builder({ rootName: "xml", headless: true, cdata: true });
//   return builder.buildObject(obj);
// };

// // Helper: Generate WeChat-style signature
// const generateSign = (params) => {
//   const stringA = Object.keys(params)
//     .filter((key) => key !== "sign" && params[key] !== undefined && params[key] !== "")
//     .sort()
//     .map((key) => `${key}=${params[key]}`)
//     .join("&");
//   const stringSignTemp = `${stringA}&key=${WECHAT_API_KEY}`;
//   return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
// };

// exports.handler = async (event) => {
//   try {
//     const rawXml = event.body;
//     const parsed = await xml2js.parseStringPromise(rawXml, { explicitArray: false });
//     const data = parsed.xml;

//     console.log("📩 Received WeChat Notify:", data);

//     // Verify signature
//     const sign = data.sign;
//     const generatedSign = generateSign(data);
//     if (sign !== generatedSign) {
//       console.warn("⚠️ Invalid signature from WeChat");
//       return {
//         statusCode: 200,
//         body: buildXml({ return_code: "FAIL", return_msg: "Invalid signature" }),
//       };
//     }

//     if (data.return_code === "SUCCESS" && data.result_code === "SUCCESS") {
//       const out_trade_no = data.out_trade_no;
//       const total_fee = parseFloat(data.total_fee) / 100; // convert to RMB

//       const db = await connectDB();

//       // Check existing order
//       const order = await db.collection("wechat_orders").findOne({ out_trade_no });
//       if (!order) {
//         return {
//           statusCode: 200,
//           body: buildXml({ return_code: "FAIL", return_msg: "Order not found" }),
//         };
//       }

//       // Prevent double updates
//       if (order.status === "PAID") {
//         return {
//           statusCode: 200,
//           body: buildXml({ return_code: "SUCCESS", return_msg: "OK" }),
//         };
//       }

//       // Update wallet
//       const userId = order.userId;
//       const user = await db.collection("wallets").findOne({ userId });
//       const newBalance = (user?.balance || 0) + total_fee;

//       await db.collection("wallets").updateOne(
//         { userId },
//         { $set: { balance: newBalance } },
//         { upsert: true }
//       );

//       // Update order status
//       await db.collection("wechat_orders").updateOne(
//         { out_trade_no },
//         { $set: { status: "PAID", paidAt: new Date() } }
//       );

//       console.log(`✅ Wallet updated for ${userId} → +${total_fee} RMB`);

//       return {
//         statusCode: 200,
//         body: buildXml({ return_code: "SUCCESS", return_msg: "OK" }),
//       };
//     } else {
//       console.warn("❌ Payment failed:", data.err_code_des);
//       return {
//         statusCode: 200,
//         body: buildXml({ return_code: "FAIL", return_msg: data.err_code_des }),
//       };
//     }
//   } catch (err) {
//     console.error("❌ Notify handler error:", err);
//     return {
//       statusCode: 500,
//       body: buildXml({ return_code: "FAIL", return_msg: "Internal Error" }),
//     };
//   }
// };
