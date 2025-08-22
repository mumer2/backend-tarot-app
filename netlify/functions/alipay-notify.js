// netlify/functions/alipay-notify.js
export const handler = async (event) => {
  try {
    // Alipay sends POST with form-encoded body
    const body = event.body;
    const params = new URLSearchParams(body);

    // ✅ Dynamic import for Netlify (ESM safe)
    const { default: AlipaySdk } = await import("alipay-sdk");
    const alipaySdk = new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.APP_PRIVATE_KEY,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
    });

    // Convert params to object
    const notifyData = {};
    for (const [key, value] of params.entries()) {
      notifyData[key] = value;
    }

    // ✅ Verify signature
    const isVerified = alipaySdk.checkNotifySign(notifyData);

    if (!isVerified) {
      return {
        statusCode: 400,
        body: "fail", // ❌ Signature invalid
      };
    }

    // ✅ Payment succeeded
    if (notifyData.trade_status === "TRADE_SUCCESS") {
      const outTradeNo = notifyData.out_trade_no; // our order id
      const totalAmount = parseFloat(notifyData.total_amount);
      const userId = notifyData.passback_params || null;

      console.log("✅ Payment success:", {
        orderId: outTradeNo,
        amount: totalAmount,
        userId,
      });

      // TODO: Update MongoDB or your DB with new balance
      // Example:
      /*
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      const db = client.db("tarot-station");
      await db.collection("wallets").updateOne(
        { userId },
        { $inc: { balance: totalAmount } },
        { upsert: true }
      );
      */

      return {
        statusCode: 200,
        body: "success", // ✅ Must return "success"
      };
    }

    return {
      statusCode: 200,
      body: "success", // Even if not TRADE_SUCCESS, must return success to stop retries
    };
  } catch (err) {
    console.error("❌ Notify error:", err);
    return {
      statusCode: 500,
      body: "fail",
    };
  }
};




// // const crypto = require("crypto");
// // const { MongoClient } = require("mongodb");

// // let cachedDb = null;
// // const connectToDatabase = async (uri) => {
// //   if (cachedDb) return cachedDb;
// //   const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
// //   await client.connect();
// //   cachedDb = client.db("tarot-station");
// //   return cachedDb;
// // };

// // // ✅ Verify Alipay signature
// // function verifyAlipaySignature(params, alipayPublicKey) {
// //   const { sign, sign_type, ...unsignedParams } = params;

// //   const sortedParams = Object.keys(unsignedParams)
// //     .sort()
// //     .map((key) => `${key}=${unsignedParams[key]}`)
// //     .join("&");

// //   const verifier = crypto.createVerify("RSA-SHA256");
// //   verifier.update(sortedParams, "utf8");

// //   return verifier.verify(alipayPublicKey, sign, "base64");
// // }

// // exports.handler = async (event) => {
// //   if (event.httpMethod !== "POST") {
// //     return { statusCode: 405, body: "Method Not Allowed" };
// //   }

// //   try {
// //     // Alipay sends x-www-form-urlencoded
// //     const bodyString = event.isBase64Encoded
// //       ? Buffer.from(event.body || "", "base64").toString("utf8")
// //       : (event.body || "");

// //     const params = Object.fromEntries(new URLSearchParams(bodyString));

// //     // ✅ Verify signature
// //     const isValid = verifyAlipaySignature(params, process.env.ALIPAY_PUBLIC_KEY);
// //     if (!isValid) {
// //       console.warn("❌ Invalid Alipay notify sign:", params);
// //       return { statusCode: 400, body: "invalid sign" };
// //     }

// //     const tradeStatus = params.trade_status;
// //     const outTradeNo = params.out_trade_no;
// //     const userId = params.passback_params; // you should send userId when creating order
// //     const amount = parseFloat(params.total_amount);

// //     if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
// //       try {
// //         const db = await connectToDatabase(process.env.MONGO_URI);
// //         const wallets = db.collection("wallets");
// //         const recharges = db.collection("wallet_history");

// //         // ✅ Update wallet
// //         await wallets.updateOne(
// //           { userId },
// //           { $inc: { balance: amount } },
// //           { upsert: true }
// //         );

// //         // ✅ Log recharge
// //         await recharges.insertOne({
// //           userId,
// //           amount,
// //           method: "Alipay",
// //           timestamp: new Date(),
// //           orderId: outTradeNo,
// //           status: "completed"
// //         });

// //         console.log(`✅ Wallet updated for user ${userId}: +${amount} via Alipay`);
// //       } catch (err) {
// //         console.error("❌ Database error:", err.message);
// //         return { statusCode: 500, body: "Database update failed" };
// //       }
// //     }

// //     // ✅ Must return "success" to Alipay
// //     return {
// //       statusCode: 200,
// //       headers: { "Content-Type": "text/plain" },
// //       body: "success"
// //     };
// //   } catch (err) {
// //     console.error("❌ Notify handler error:", err);
// //     return { statusCode: 500, body: "error" };
// //   }
// // };



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
