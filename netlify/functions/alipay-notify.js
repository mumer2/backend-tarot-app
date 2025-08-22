// netlify/functions/alipay-notify.js
const { MongoClient } = require('mongodb');
const querystring = require('querystring');
const {AlipaySdk} = require('alipay-sdk');

const appId = process.env.ALIPAY_APP_ID;
const privateKey = process.env.APP_PRIVATE_KEY;
const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
const gateway = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
const mongoUri = process.env.MONGO_URI;
const mongoDbName = 'tarot-station';

let cachedDb;
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
  signType: 'RSA2',
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Alipay sends application/x-www-form-urlencoded body
  const params = querystring.parse(event.body || '');

  try {
    // Verify signature
    const valid = alipay.checkNotifySign(params);
    if (!valid) {
      console.error('❌ Invalid Alipay signature', params);
      return { statusCode: 400, body: 'failure' };
    }

    const {
      out_trade_no: outTradeNo,
      trade_status: tradeStatus,
      trade_no: tradeNo,
      total_amount: totalAmount,
      buyer_logon_id: buyer,
      passback_params,
    } = params;

    // Only treat success statuses as paid
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      try {
        const db = await connectToDatabase();
        const wallets = db.collection('wallets');
        const recharges = db.collection('wallet_history');
        const orders = db.collection('orders');

        // Try to extract userId from outTradeNo (we created as ORD_<userId>_<random>)
        let userId = 'unknown_user';
        if (typeof outTradeNo === 'string' && outTradeNo.startsWith('ORD_')) {
          const parts = outTradeNo.split('_');
          if (parts.length >= 3) {
            userId = parts[1];
          }
        }

        const amount = parseFloat(totalAmount || '0');

        // Update wallet balance
        await wallets.updateOne(
          { userId },
          { $inc: { balance: amount } },
          { upsert: true }
        );

        // Save recharge history
        await recharges.insertOne({
          userId,
          amount,
          method: 'Alipay',
          timestamp: new Date(),
          tradeNo,
          outTradeNo,
          buyer,
          passback_params: passback_params || null,
          status: 'completed',
        });

        // Update order status as PAID
        await orders.updateOne(
          { outTradeNo },
          {
            $set: {
              status: 'PAID',
              tradeNo,
              totalAmount: amount,
              buyer,
              updatedAt: new Date(),
            },
          }
        );

        console.log(`✅ Alipay payment recorded for user ${userId}: +${amount}`);
      } catch (err) {
        console.error('❌ Database error in notify:', err);
        // Return 200 with 'failure' to prompt Alipay retry (or return failure per preferences).
        return { statusCode: 200, body: 'failure' };
      }

      // MUST return exact text 'success' for Alipay to stop retries
      return { statusCode: 200, body: 'success' };
    }

    // For other trade statuses, update order and return success
    try {
      const db = await connectToDatabase();
      await db.collection('orders').updateOne(
        { outTradeNo },
        { $set: { status: tradeStatus || 'UNKNOWN', updatedAt: new Date() } }
      );
    } catch (e) {
      console.error('Error updating order for non-success status', e);
    }

    return { statusCode: 200, body: 'success' };
  } catch (err) {
    console.error('Notify handler error', err);
    // Return 200 so Alipay may retry the notify (common pattern)
    return { statusCode: 200, body: 'failure' };
  }
};




// const crypto = require("crypto");
// const { MongoClient } = require("mongodb");

// let cachedDb = null;
// const connectToDatabase = async (uri) => {
//   if (cachedDb) return cachedDb;
//   const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//   await client.connect();
//   cachedDb = client.db("tarot-station");
//   return cachedDb;
// };

// // ✅ Verify Alipay signature
// function verifyAlipaySignature(params, alipayPublicKey) {
//   const { sign, sign_type, ...unsignedParams } = params;

//   const sortedParams = Object.keys(unsignedParams)
//     .sort()
//     .map((key) => `${key}=${unsignedParams[key]}`)
//     .join("&");

//   const verifier = crypto.createVerify("RSA-SHA256");
//   verifier.update(sortedParams, "utf8");

//   return verifier.verify(alipayPublicKey, sign, "base64");
// }

// exports.handler = async (event) => {
//   if (event.httpMethod !== "POST") {
//     return { statusCode: 405, body: "Method Not Allowed" };
//   }

//   try {
//     // Alipay sends x-www-form-urlencoded
//     const bodyString = event.isBase64Encoded
//       ? Buffer.from(event.body || "", "base64").toString("utf8")
//       : (event.body || "");

//     const params = Object.fromEntries(new URLSearchParams(bodyString));

//     // ✅ Verify signature
//     const isValid = verifyAlipaySignature(params, process.env.ALIPAY_PUBLIC_KEY);
//     if (!isValid) {
//       console.warn("❌ Invalid Alipay notify sign:", params);
//       return { statusCode: 400, body: "invalid sign" };
//     }

//     const tradeStatus = params.trade_status;
//     const outTradeNo = params.out_trade_no;
//     const userId = params.passback_params; // you should send userId when creating order
//     const amount = parseFloat(params.total_amount);

//     if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
//       try {
//         const db = await connectToDatabase(process.env.MONGO_URI);
//         const wallets = db.collection("wallets");
//         const recharges = db.collection("wallet_history");

//         // ✅ Update wallet
//         await wallets.updateOne(
//           { userId },
//           { $inc: { balance: amount } },
//           { upsert: true }
//         );

//         // ✅ Log recharge
//         await recharges.insertOne({
//           userId,
//           amount,
//           method: "Alipay",
//           timestamp: new Date(),
//           orderId: outTradeNo,
//           status: "completed"
//         });

//         console.log(`✅ Wallet updated for user ${userId}: +${amount} via Alipay`);
//       } catch (err) {
//         console.error("❌ Database error:", err.message);
//         return { statusCode: 500, body: "Database update failed" };
//       }
//     }

//     // ✅ Must return "success" to Alipay
//     return {
//       statusCode: 200,
//       headers: { "Content-Type": "text/plain" },
//       body: "success"
//     };
//   } catch (err) {
//     console.error("❌ Notify handler error:", err);
//     return { statusCode: 500, body: "error" };
//   }
// };



// // netlify/functions/alipay-notify.js
// const { AlipaySdk } = require("alipay-sdk");
// const qs = require("qs");

// const alipay = new AlipaySdk({
//   appId: process.env.ALIPAY_APP_ID,
//   privateKey: process.env.APP_PRIVATE_KEY,
//   alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
//   gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do",
//   signType: "RSA2",
// });

// // Simple response helper
// function textResponse(body, status = 200) {
//   return {
//     statusCode: status,
//     headers: {
//       "Content-Type": "text/plain",
//       "Access-Control-Allow-Origin": "*",
//     },
//     body,
//   };
// }

// exports.handler = async (event) => {
//   try {
//     // Alipay sends `application/x-www-form-urlencoded`
//     const isForm =
//       (event.headers["content-type"] ||
//         event.headers["Content-Type"] ||
//         "").includes("application/x-www-form-urlencoded");

//     const bodyString = event.isBase64Encoded
//       ? Buffer.from(event.body || "", "base64").toString("utf8")
//       : event.body || "";

//     const payload = isForm
//       ? qs.parse(bodyString)
//       : (() => {
//           try {
//             return JSON.parse(bodyString);
//           } catch {
//             return {};
//           }
//         })();

//     // ✅ Verify signature
//     const ok = alipay.checkNotifySign(payload);

//     if (!ok) {
//       console.warn("❌ Invalid Alipay notify sign:", payload);
//       return textResponse("invalid sign", 400);
//     }

//     const tradeStatus = payload.trade_status;
//     const outTradeNo = payload.out_trade_no;

//     // ✅ Update your DB/order system here
//     if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
//       console.log("✅ Payment success:", outTradeNo);
//       // TODO: mark order as paid
//     } else {
//       console.log("ℹ️ Notify status:", tradeStatus, "for order:", outTradeNo);
//     }

//     // ✅ Alipay requires plain 'success' response
//     return textResponse("success");
//   } catch (err) {
//     console.error("❌ notify error:", err);
//     return textResponse("error", 500);
//   }
// };
