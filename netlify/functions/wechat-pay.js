const { WechatPay } = require('wechatpay-node-v3');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

dotenv.config();

let cachedDb = null;
const connectToDatabase = async (uri) => {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  cachedDb = client.db("tarot-station");
  return cachedDb;
};

// Read certs from files (adjust path as needed)
const WECHAT_PUBLIC_KEY = fs.readFileSync(path.resolve(__dirname, '../../secrets/apiclient_cert.pem'), 'utf8');
const WECHAT_PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, '../../secrets/apiclient_key.pem'), 'utf8');

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Content-Type": "application/json",
      },
      body: "",
    };
  }

  try {
    const { amount, userId } =
      event.httpMethod === "POST"
        ? JSON.parse(event.body || "{}")
        : event.queryStringParameters || {};

    if (!amount || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing amount or userId" }),
      };
    }

    const wechatPay = new WechatPay({
      mchid: process.env.WECHAT_MCH_ID,
      appid: process.env.WECHAT_APPID,
      publicKey: WECHAT_PUBLIC_KEY,
      privateKey: WECHAT_PRIVATE_KEY,
      serial: process.env.WECHAT_SERIAL_NO,
    });

    // Create H5 order
    const out_trade_no = `ORDER_${Date.now()}_${userId}`;
    const result = await wechatPay.transactions_h5({
      mchid: process.env.WECHAT_MCH_ID,
      appid: process.env.WECHAT_APPID,
      description: "Tarot Recharge",
      out_trade_no,
      amount: {
        total: Number(amount), // amount in cents
        currency: "CNY",
      },
      scene_info: {
        payer_client_ip: "127.0.0.1", // You may want to get the real client IP
        h5_info: { type: "Wap" },
      },
      notify_url: process.env.WECHAT_NOTIFY_URL,
    });

    if (result && result.h5_url) {
      // Save pending order to DB
      const db = await connectToDatabase(process.env.MONGO_URI);
      const recharges = db.collection("wallet_history");
      await recharges.insertOne({
        userId,
        amount: Number(amount) / 100,
        method: "WeChat",
        timestamp: new Date(),
        orderId: out_trade_no,
        status: "pending",
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentUrl: result.h5_url, out_trade_no }),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to create WeChat Pay order" }),
      };
    }
  } catch (error) {
    console.error("WeChat Pay Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, stack: error.stack }),
    };
  }
};



// // functions/wechat-pay.js
// const axios = require("axios");
// const crypto = require("crypto");
// const xml2js = require("xml2js");

// const APP_ID = process.env.WECHAT_APPID;
// const MCH_ID = process.env.WECHAT_MCH_ID;
// const API_KEY = process.env.WECHAT_API_KEY;
// const NOTIFY_URL = process.env.WECHAT_NOTIFY_URL; // HTTPS notify URL

// if (!APP_ID || !MCH_ID || !API_KEY || !NOTIFY_URL) {
//   console.error("❌ Missing WeChat environment variables");
// }

// const generateNonceStr = () => Math.random().toString(36).substring(2, 15);

// const generateSign = (params) => {
//   const sortedKeys = Object.keys(params).sort();
//   const stringA = sortedKeys.map(k => `${k}=${params[k]}`).join("&");
//   const stringSignTemp = `${stringA}&key=${API_KEY}`;
//   return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
// };

// const buildXML = (obj) => {
//   let xml = "<xml>";
//   for (let key in obj) xml += `<${key}>${obj[key]}</${key}>`;
//   xml += "</xml>";
//   return xml;
// };

// const parseXML = async (xmlStr) => {
//   return await xml2js.parseStringPromise(xmlStr, { explicitArray: false, trim: true });
// };

// exports.handler = async (event) => {
//   if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

//   try {
//     const { amount, userId } = JSON.parse(event.body);

//     if (!amount || !userId) return { statusCode: 400, body: "Missing amount or userId" };

//     const data = {
//       appid: APP_ID,
//       mch_id: MCH_ID,
//       nonce_str: generateNonceStr(),
//       body: "Tarot App Recharge",
//       out_trade_no: `RNWX${Date.now()}`,
//       total_fee: Math.round(amount), // amount in cents
//       spbill_create_ip: "127.0.0.1",
//       notify_url: NOTIFY_URL,
//       trade_type: "MWEB",
//       attach: userId // used in notify to credit balance
//     };

//     data.sign = generateSign(data);

//     console.log("WeChat Request XML:", buildXML(data));

//     const response = await axios.post(
//       "https://api.mch.weixin.qq.com/pay/unifiedorder",
//       buildXML(data),
//       { headers: { "Content-Type": "text/xml" } }
//     );

//     const result = await parseXML(response.data);

//     if (result.xml && result.xml.return_code === "SUCCESS" && result.xml.result_code === "SUCCESS") {
//       return {
//         statusCode: 200,
//         body: JSON.stringify({ paymentUrl: result.xml.mweb_url }),
//       };
//     } else {
//       return {
//         statusCode: 400,
//         body: JSON.stringify({ error: result.xml.return_msg || result.xml.err_code_des }),
//       };
//     }
//   } catch (err) {
//     console.error("WeChat Pay Error:", err.message);
//     return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
//   }
// };






// const axios = require("axios");
// const crypto = require("crypto");
// const { MongoClient } = require("mongodb");
// const xml2js = require("xml2js");
// require("dotenv").config();

// // Generate random nonce string
// const generateNonceStr = () => Math.random().toString(36).substring(2, 15);

// // Connect to MongoDB
// const connectDB = async () => {
//   const client = new MongoClient(process.env.MONGO_URI);
//   await client.connect();
//   return client.db("tarot-station");
// };

// // Generate WeChat MD5 sign
// const createSign = (params, key) => {
//   const stringA = Object.keys(params)
//     .filter(k => k !== "sign" && params[k] !== undefined && params[k] !== "")
//     .sort()
//     .map(k => `${k}=${params[k]}`)
//     .join("&");
//   const stringSignTemp = `${stringA}&key=${key}`;
//   return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
// };

// // Build compact XML
// const buildWeChatXML = (params) => `<xml>
// <appid><![CDATA[${params.appid}]]></appid>
// <mch_id><![CDATA[${params.mch_id}]]></mch_id>
// <nonce_str><![CDATA[${params.nonce_str}]]></nonce_str>
// <body><![CDATA[${params.body}]]></body>
// <out_trade_no><![CDATA[${params.out_trade_no}]]></out_trade_no>
// <total_fee>${params.total_fee}</total_fee>
// <spbill_create_ip><![CDATA[${params.spbill_create_ip}]]></spbill_create_ip>
// <notify_url><![CDATA[${params.notify_url}]]></notify_url>
// <trade_type><![CDATA[${params.trade_type}]]></trade_type>
// <scene_info><![CDATA[${params.scene_info}]]></scene_info>
// <sign><![CDATA[${params.sign}]]></sign>
// </xml>`;

// exports.handler = async (event) => {
//   try {
//     const body = JSON.parse(event.body || "{}");
//     const total_fee = body.total_fee ? Math.floor(body.total_fee) : 100; // 1.00 CNY default
//     const userId = (body.userId || "guest").toString();
//     const out_trade_no = `U${userId.slice(0, 6)}${Date.now().toString().slice(-10)}`;

//     // Config
//     const appid = process.env.WECHAT_APPID;
//     const mch_id = process.env.WECHAT_MCH_ID;
//     const key = process.env.WECHAT_API_KEY;
//     const notify_url = "https://backend-tarot-app.netlify.app/.netlify/functions/wechat-notify";
//     const redirect_url = "https://successscreen.netlify.app/success.html";
//     const trade_type = "MWEB";

//     // Force valid IPv4
//     const ipHeader = event.headers['x-forwarded-for'] || '';
//     let ip = ipHeader.split(',')[0]?.trim() || "1.1.1.1";
//     if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) ip = "1.1.1.1";

//     // H5 scene info (compact JSON)
//     const scene_info_json = JSON.stringify({
//       h5_info: {
//         type: "Wap",
//         wap_url: "https://tarotstation.netlify.app/",
//         wap_name: "Tarot Wallet"
//       }
//     });

//     const params = {
//       appid,
//       mch_id,
//       nonce_str: generateNonceStr(),
//       body: "Tarot Wallet Recharge",
//       out_trade_no,
//       total_fee: total_fee.toString(),
//       spbill_create_ip: ip,
//       notify_url,
//       trade_type,
//       scene_info: scene_info_json
//     };

//     // Generate sign
//     params.sign = createSign(params, key);

//     // Build XML
//     const xmlData = buildWeChatXML(params);

//     // Send request to WeChat
//     const response = await axios.post(
//       "https://api.mch.weixin.qq.com/pay/unifiedorder",
//       xmlData,
//       { headers: { "Content-Type": "text/xml; charset=utf-8" } }
//     );

//     // Parse XML response
//     const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
//     const result = parsed.xml;

//     if (result.return_code === "SUCCESS" && result.result_code === "SUCCESS") {
//       const mweb_url = `${result.mweb_url}&redirect_url=${encodeURIComponent(redirect_url)}`;

//       // Save order in DB
//       const db = await connectDB();
//       await db.collection("wechat_orders").insertOne({
//         out_trade_no,
//         userId,
//         total_fee,
//         status: "PENDING",
//         createdAt: new Date()
//       });

//       return {
//         statusCode: 200,
//         body: JSON.stringify({ paymentUrl: mweb_url, out_trade_no })
//       };
//     } else {
//       return {
//         statusCode: 400,
//         body: JSON.stringify({
//           error: result.return_msg || result.err_code_des || "WeChat error",
//           raw: result
//         })
//       };
//     }
//   } catch (err) {
//     console.error("❌ WeChat H5 Pay Error:", err.message || err);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: err.message || "Unexpected error" })
//     };
//   }
// };






// const axios = require("axios");
// const crypto = require("crypto");
// const { MongoClient } = require("mongodb");
// require("dotenv").config();

// const generateNonceStr = () => Math.random().toString(36).substring(2, 15);

// const connectDB = async () => {
//   const client = new MongoClient(process.env.MONGO_URI);
//   await client.connect();
//   return client.db("tarot-station");
// };

// // WeChat sign generator
// const createSign = (params, key) => {
//   const stringA = Object.keys(params)
//     .filter(k => k !== "sign" && params[k] !== undefined && params[k] !== "")
//     .sort()
//     .map(k => `${k}=${params[k]}`)
//     .join("&");
//   const stringSignTemp = `${stringA}&key=${key}`;
//   console.log("🔍 String to sign:", stringSignTemp);
//   return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
// };

// // Build XML manually to avoid WeChat JSON escaping issues
// const buildWeChatXML = (params) => {
//   return `
// <xml>
//   <appid><![CDATA[${params.appid}]]></appid>
//   <mch_id><![CDATA[${params.mch_id}]]></mch_id>
//   <nonce_str><![CDATA[${params.nonce_str}]]></nonce_str>
//   <body><![CDATA[${params.body}]]></body>
//   <out_trade_no><![CDATA[${params.out_trade_no}]]></out_trade_no>
//   <total_fee>${params.total_fee}</total_fee>
//   <spbill_create_ip><![CDATA[${params.spbill_create_ip}]]></spbill_create_ip>
//   <notify_url><![CDATA[${params.notify_url}]]></notify_url>
//   <trade_type><![CDATA[${params.trade_type}]]></trade_type>
//   <scene_info>${params.scene_info}</scene_info>
//   <sign><![CDATA[${params.sign}]]></sign>
// </xml>
//   `.trim();
// };

// exports.handler = async (event) => {
//   try {
//     const body = JSON.parse(event.body || "{}");
//     const total_fee = body.total_fee || 1;
//     const userId = (body.userId || "guest").toString();

//     const shortUserId = userId.slice(0, 6);
//     const out_trade_no = `U${shortUserId}${Date.now().toString().slice(-10)}`;

//     // Config
//     const appid = process.env.WECHAT_APPID;
//     const mch_id = process.env.WECHAT_MCH_ID;
//     const key = process.env.WECHAT_API_KEY;
//     const notify_url = "https://backend-tarot-app.netlify.app/.netlify/functions/wechat-notify";
//     const redirect_url = "https://successscreen.netlify.app/success.html";
//     const trade_type = "MWEB";
//     const ip = event.headers['x-forwarded-for']?.split(',')[0] || "8.8.8.8";

//     // scene_info must be raw JSON
//     const scene_info_json = JSON.stringify({
//       h5_info: {
//         type: "Wap",
//         wap_url: "https://tarotstation.netlify.app/",
//         wap_name: "Tarot Wallet"
//       }
//     });

//     const params = {
//       appid,
//       mch_id,
//       nonce_str: generateNonceStr(),
//       body: "Tarot Wallet Recharge",
//       out_trade_no,
//       total_fee: total_fee.toString(),
//       spbill_create_ip: ip,
//       notify_url,
//       trade_type,
//       scene_info: scene_info_json
//     };

//     const sign = createSign(params, key);
//     params.sign = sign;

//     const xmlData = buildWeChatXML(params);
//     console.log("📤 XML sent to WeChat:\n", xmlData);

//     const response = await axios.post(
//       "https://api.mch.weixin.qq.com/pay/unifiedorder",
//       xmlData,
//       { headers: { "Content-Type": "text/xml; charset=utf-8" } }
//     );

//     const xml2js = require("xml2js");
//     const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
//     const result = parsed.xml;

//     console.log("🟢 WeChat unifiedorder response:", result);

//     if (result.return_code === "SUCCESS" && result.result_code === "SUCCESS") {
//       const mweb_url = `${result.mweb_url}&redirect_url=${encodeURIComponent(redirect_url)}`;

//       // Save order in DB
//       const db = await connectDB();
//       await db.collection("wechat_orders").insertOne({
//         out_trade_no,
//         userId,
//         total_fee,
//         status: "PENDING",
//         createdAt: new Date()
//       });

//       return {
//         statusCode: 200,
//         body: JSON.stringify({
//           paymentUrl: mweb_url,
//           out_trade_no
//         })
//       };
//     } else {
//       return {
//         statusCode: 400,
//         body: JSON.stringify({
//           error: result.return_msg || result.err_code_des || "WeChat error",
//           raw: result
//         })
//       };
//     }
//   } catch (err) {
//     console.error("❌ WeChat H5 Pay Error:", err.message || err, err.stack);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: err.message || "Unexpected error" })
//     };
//   }
// };




// const axios = require("axios");
// const crypto = require("crypto");
// const xml2js = require("xml2js");
// const { MongoClient } = require("mongodb");
// require("dotenv").config();

// const generateNonceStr = () => Math.random().toString(36).substring(2, 15);
// const connectDB = async () => {
//   const client = new MongoClient(process.env.MONGO_URI);
//   await client.connect();
//   return client.db("tarot-station");
// };

// const createSign = (params, key) => {
//   const stringA = Object.keys(params)
//     .filter(k => params[k] !== undefined && params[k] !== "")
//     .sort()
//     .map(k => `${k}=${params[k]}`)
//     .join("&");
//   const stringSignTemp = `${stringA}&key=${key}`;
//   return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
// };

// exports.handler = async (event) => {
//   try {
//     const body = JSON.parse(event.body || "{}");
//     const total_fee = body.total_fee || 1;
//     const userId = (body.userId || "guest").toString();

//     const shortUserId = userId.slice(0, 6);
//     const out_trade_no = `U${shortUserId}${Date.now().toString().slice(-10)}`;

//     // ✅ CONFIG
//     const appid = process.env.WECHAT_APPID;
//     const mch_id = process.env.WECHAT_MCH_ID;
//     const key = process.env.WECHAT_API_KEY;
//     const notify_url = "https://backend-tarot-app.netlify.app/.netlify/functions/wechat-notify";
//     const redirect_url = "https://tarotstation.com/payment-success"; // ✅ Your whitelisted redirect page
//     const trade_type = "MWEB";

//    const params = {
//   appid,
//   mch_id,
//   nonce_str: generateNonceStr(),
//   body: "Tarot Wallet Recharge",
//   out_trade_no,
//   total_fee: total_fee.toString(),
//   spbill_create_ip: event.headers['x-forwarded-for']?.split(',')[0] || "8.8.8.8",
//   notify_url,
//   trade_type,
//   scene_info: `{"h5_info":{"type":"Wap","wap_url":"https://tarotstation.com","wap_name":"Tarot Wallet"}}`
// };


//     const sign = createSign(params, key);
//     const builder = new xml2js.Builder({ rootName: "xml", headless: true, cdata: true });
//     const xmlData = builder.buildObject({ ...params, sign });

//     const response = await axios.post(
//       "https://api.mch.weixin.qq.com/pay/unifiedorder",
//       xmlData,
//       { headers: { "Content-Type": "text/xml; charset=utf-8" } }
//     );

//     const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
//     const result = parsed.xml;

//     console.log("🟢 WeChat H5 Pay Response:", result);

//     if (result.return_code === "SUCCESS" && result.result_code === "SUCCESS") {
//       const mweb_url = `${result.mweb_url}&redirect_url=${encodeURIComponent(redirect_url)}`;

//       // ✅ Save order to DB
//       const db = await connectDB();
//       await db.collection("wechat_orders").insertOne({
//         out_trade_no,
//         userId,
//         total_fee,
//         status: "PENDING",
//         createdAt: new Date()
//       });

//       return {
//         statusCode: 200,
//         body: JSON.stringify({
//           paymentUrl: mweb_url,
//           out_trade_no
//         })
//       };
//     } else {
//       return {
//         statusCode: 400,
//         body: JSON.stringify({
//           error: result.return_msg || result.err_code_des || "WeChat error",
//           raw: result
//         })
//       };
//     }
//   } catch (err) {
//     console.error("❌ WeChat H5 Pay Error:", err.message || err, err.stack);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({
//         error: err.message || "Unexpected error"
//       })
//     };
//   }
// };
