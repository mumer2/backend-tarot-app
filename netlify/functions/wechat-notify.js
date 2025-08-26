const { WechatPay } = require('wechatpay-node-v3');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const getRawBody = require('raw-body');

dotenv.config();

let cachedDb = null;
const connectToDatabase = async (uri) => {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  cachedDb = client.db("tarot-station");
  return cachedDb;
};

const wechatPay = new WechatPay({
  mchid: process.env.WECHAT_MCH_ID,
  appid: process.env.WECHAT_APPID,
  publicKey: process.env.WECHAT_PUBLIC_KEY,
  privateKey: process.env.WECHAT_PRIVATE_KEY,
  serial: process.env.WECHAT_SERIAL_NO,
});

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  try {
    // Get raw body for signature verification
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    // WeChat headers for signature verification
    const headers = event.headers;
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serial = headers['wechatpay-serial'];

    // Verify and decrypt notification
    const notifyData = await wechatPay.callback(
      body,
      signature,
      timestamp,
      nonce,
      serial
    );

    // Example: { out_trade_no, transaction_id, trade_state, ... }
    const { out_trade_no, trade_state, amount } = notifyData;

    // Update order in DB
    const db = await connectToDatabase(process.env.MONGO_URI);
    const recharges = db.collection("wallet_history");
    await recharges.updateOne(
      { orderId: out_trade_no },
      {
        $set: {
          status: trade_state === "SUCCESS" ? "success" : trade_state.toLowerCase(),
          wechat_transaction_id: notifyData.transaction_id,
          paid_amount: amount && amount.payer_total ? amount.payer_total / 100 : undefined,
          paid_at: new Date(),
        },
      }
    );

    // Respond to WeChat (must be exactly this for success)
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "SUCCESS", message: "成功" }),
    };
  } catch (error) {
    console.error("WeChat Notify Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ code: "FAIL", message: error.message }),
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

// const buildXml = (obj) => {
//   const builder = new xml2js.Builder({ rootName: "xml", headless: true, cdata: true });
//   return builder.buildObject(obj);
// };

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
//       return { statusCode: 200, body: buildXml({ return_code: "FAIL", return_msg: "Invalid signature" }) };
//     }

//     if (data.return_code === "SUCCESS" && data.result_code === "SUCCESS") {
//       const out_trade_no = data.out_trade_no;
//       const total_fee = parseFloat(data.total_fee) / 100;

//       const db = await connectDB();
//       const order = await db.collection("wechat_orders").findOne({ out_trade_no });
//       if (!order) {
//         return { statusCode: 200, body: buildXml({ return_code: "FAIL", return_msg: "Order not found" }) };
//       }

//       if (order.status === "PAID") {
//         return { statusCode: 200, body: buildXml({ return_code: "SUCCESS", return_msg: "OK" }) };
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

//       // Update order
//       await db.collection("wechat_orders").updateOne(
//         { out_trade_no },
//         { $set: { status: "PAID", paidAt: new Date() } }
//       );

//       console.log(`✅ Wallet updated for ${userId} → +${total_fee} RMB`);

//       return { statusCode: 200, body: buildXml({ return_code: "SUCCESS", return_msg: "OK" }) };
//     } else {
//       console.warn("❌ Payment failed:", data.err_code_des);
//       return { statusCode: 200, body: buildXml({ return_code: "FAIL", return_msg: data.err_code_des }) };
//     }
//   } catch (err) {
//     console.error("❌ Notify handler error:", err);
//     return { statusCode: 500, body: buildXml({ return_code: "FAIL", return_msg: "Internal Error" }) };
//   }
// };



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
