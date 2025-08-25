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
  appId: process.env.ALIPAY_APPID,
  privateKey: process.env.APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY.replace(/\\n/g, "\n"),
  gateway: "https://openapi.alipaydev.com/gateway.do", // sandbox
  signType: "RSA2",
});

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { trade_status, out_trade_no, buyer_logon_id, total_amount } = body;

    if (trade_status === "TRADE_SUCCESS") {
      console.log(`✅ Payment successful for order: ${out_trade_no}`);

      // ✅ Extract metadata (you should attach userId when creating the order)
      const userId = body.passback_params || null; // Alipay supports custom data
      const amount = parseFloat(total_amount);

      if (!userId) {
        console.warn("⚠️ Missing userId in Alipay callback");
        return { statusCode: 400, body: "Missing userId in metadata" };
      }

      const db = await connectToDatabase(process.env.MONGO_URI);
      const wallets = db.collection("wallets");
      const recharges = db.collection("wallet_history");

      // ✅ Idempotency check
      const exists = await recharges.findOne({ orderId: out_trade_no });
      if (exists) {
        console.log("⚠️ Duplicate notification ignored");
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      }

      // ✅ Update wallet balance
      await wallets.updateOne(
        { userId },
        { $inc: { balance: amount } },
        { upsert: true }
      );

      // ✅ Save recharge history
      await recharges.insertOne({
        userId,
        amount,
        method: "Alipay",
        timestamp: new Date(),
        orderId: out_trade_no,
        email: buyer_logon_id || "",
        status: "completed",
      });

      console.log(`✅ Wallet updated and recharge logged for user ${userId}: +${amount} USD`);
    } else {
      console.log(`❌ Payment not successful for order: ${out_trade_no}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Alipay Notify Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};





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


