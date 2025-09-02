// alipayNotify.js
const { AlipaySdk } = require("alipay-sdk");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");
const qs = require("querystring");

dotenv.config();

let cachedDb = null;
const connectToDatabase = async (uri) => {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri);
  await client.connect();
  cachedDb = client.db("tarot-station");
  return cachedDb;
};

const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, "\n"),
  gateway: "https://openapi.alipay.com/gateway.do",
  signType: "RSA2",
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Alipay sends x-www-form-urlencoded
    const params = qs.parse(event.body);

    // ✅ verify signature
    const isValid = alipaySdk.checkNotifySign(params);
    if (!isValid) {
      return { statusCode: 400, body: "Invalid signature" };
    }

    // ✅ Only update wallet on success
    if (params.trade_status === "TRADE_SUCCESS" || params.trade_status === "TRADE_FINISHED") {
      const userId = decodeURIComponent(params.passback_params);
      const orderId = params.out_trade_no;
      const amount = parseFloat(params.total_amount);

      const db = await connectToDatabase(process.env.MONGO_URI);
      const wallets = db.collection("wallets");
      const recharges = db.collection("wallet_history");

      // Update wallet balance
      await wallets.updateOne(
        { userId },
        { $inc: { balance: amount } },
        { upsert: true }
      );

      // Update recharge record to completed
      await recharges.updateOne(
        { orderId },
        {
          $set: {
            status: "completed",
            alipay_trade_no: params.trade_no,
            timestamp: new Date(),
          },
        }
      );

      console.log(`✅ Wallet updated and recharge completed for ${userId}: +${amount} RMB`);
    }

    // ✅ Must reply "success"
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain" },
      body: "success",
    };
  } catch (error) {
    console.error("Alipay Notify Error:", error);
    return { statusCode: 500, body: "fail" };
  }
};




// const { AlipaySdk } = require("alipay-sdk");
// const dotenv = require("dotenv");
// const { MongoClient } = require("mongodb");
// const qs = require("querystring");

// dotenv.config();

// let cachedDb = null;
// const connectToDatabase = async (uri) => {
//   if (cachedDb) return cachedDb;
//   const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//   await client.connect();
//   cachedDb = client.db("tarot-station");
//   return cachedDb;
// };

// const alipaySdk = new AlipaySdk({
//   appId: process.env.ALIPAY_APP_ID,
//   privateKey: process.env.APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
//   alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, "\n"),
//   gateway: "https://openapi.alipay.com/gateway.do",
//   signType: "RSA2",
// });

// exports.handler = async (event) => {
//   if (event.httpMethod !== "POST") {
//     return { statusCode: 405, body: "Method Not Allowed" };
//   }

//   try {
//     // Alipay sends x-www-form-urlencoded
//     const params = qs.parse(event.body);

//     // 1. Verify signature
//     const isValid = alipaySdk.checkNotifySign(params);
//     if (!isValid) {
//       return { statusCode: 400, body: "Invalid signature" };
//     }

//     // 2. Check payment status
//     if (params.trade_status === "TRADE_SUCCESS" || params.trade_status === "TRADE_FINISHED") {
//       const userId = params.passback_params;
//       const orderId = params.out_trade_no;
//       const amount = parseFloat(params.total_amount);

//       // 3. Update order and wallet in DB
//       const db = await connectToDatabase(process.env.MONGO_URI);
//       const wallets = db.collection("wallets");
//       const recharges = db.collection("wallet_history");

//       // Update wallet balance
//       await wallets.updateOne(
//         { userId },
//         { $inc: { balance: amount } },
//         { upsert: true }
//       );

//       // Save recharge history
//       await recharges.updateOne(
//         { orderId },
//         {
//           $set: {
//             userId,
//             amount,
//             method: "Alipay",
//             timestamp: new Date(),
//             status: "completed",
//             alipay_trade_no: params.trade_no,
//           }
//         },
//         { upsert: true }
//       );

//       console.log(`✅ Wallet updated and recharge logged for user ${userId}: +${amount} RMB`);
//     }

//     // 4. Respond to Alipay (must be "success")
//     return {
//       statusCode: 200,
//       headers: { "Content-Type": "text/plain" },
//       body: "success",
//     };
//   } catch (error) {
//     console.error("Alipay Notify Error:", error);
//     return { statusCode: 500, body: "fail" };
//   }
// };

// const { AlipaySdk } = require("alipay-sdk");
// const dotenv = require("dotenv");
// const { MongoClient } = require("mongodb");

// dotenv.config();

// let cachedDb = null;
// const connectToDatabase = async (uri) => {
//   if (cachedDb) return cachedDb;
//   const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//   await client.connect();
//   cachedDb = client.db("tarot-station");
//   return cachedDb;
// };

// const alipaySdk = new AlipaySdk({
//   appId: process.env.ALIPAY_APPID,
//   privateKey: process.env.APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
//   alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, "\n"),
//   gateway: "https://openapi.alipaydev.com/gateway.do", // sandbox
//   signType: "RSA2",
// });

// exports.handler = async (event) => {
//   try {
//     const body = JSON.parse(event.body || "{}");
//     const { trade_status, out_trade_no, buyer_logon_id, total_amount } = body;

//     if (trade_status === "TRADE_SUCCESS") {
//       console.log(`✅ Payment successful for order: ${out_trade_no}`);

//       // ✅ Extract metadata (you should attach userId when creating the order)
//       const userId = body.passback_params || null; // Alipay supports custom data
//       const amount = parseFloat(total_amount);

//       if (!userId) {
//         console.warn("⚠️ Missing userId in Alipay callback");
//         return { statusCode: 400, body: "Missing userId in metadata" };
//       }

//       const db = await connectToDatabase(process.env.MONGO_URI);
//       const wallets = db.collection("wallets");
//       const recharges = db.collection("wallet_history");

//       // ✅ Idempotency check
//       const exists = await recharges.findOne({ orderId: out_trade_no });
//       if (exists) {
//         console.log("⚠️ Duplicate notification ignored");
//         return { statusCode: 200, body: JSON.stringify({ success: true }) };
//       }

//       // ✅ Update wallet balance
//       await wallets.updateOne(
//         { userId },
//         { $inc: { balance: amount } },
//         { upsert: true }
//       );

//       // ✅ Save recharge history
//       await recharges.insertOne({
//         userId,
//         amount,
//         method: "Alipay",
//         timestamp: new Date(),
//         orderId: out_trade_no,
//         email: buyer_logon_id || "",
//         status: "completed",
//       });

//       console.log(`✅ Wallet updated and recharge logged for user ${userId}: +${amount} USD`);
//     } else {
//       console.log(`❌ Payment not successful for order: ${out_trade_no}`);
//     }

//     return {
//       statusCode: 200,
//       body: JSON.stringify({ success: true }),
//     };
//   } catch (error) {
//     console.error("Alipay Notify Error:", error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ success: false, error: error.message }),
//     };
//   }
// };





// const { AlipaySdk } = require("alipay-sdk");
// const dotenv = require("dotenv");

// dotenv.config();

// const alipaySdk = new AlipaySdk({
//   appId: process.env.ALIPAY_APPID,
//   privateKey: process.env.APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
//   alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, '\n'),
//   gateway: 'https://openapi.alipaydev.com/gateway.do',
//   signType: 'RSA2',
// });

// exports.handler = async (event) => {
//   try {
//     const body = JSON.parse(event.body || '{}');
//     const { trade_status, out_trade_no } = body;

//     if (trade_status === 'TRADE_SUCCESS') {
//       // Update order status in your database
//       console.log(`Payment successful for order: ${out_trade_no}`);
//       // Here you would typically update the order status in your database
//     } else {
//       console.log(`Payment not successful for order: ${out_trade_no}`);
//     }

//     return {
//       statusCode: 200,
//       body: JSON.stringify({ success: true }),
//     };
//   } catch (error) {
//     console.error('Alipay Notify Error:', error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ success: false, error: error.message }),
//     };
//   }
// };


