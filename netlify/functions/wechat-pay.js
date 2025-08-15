const axios = require("axios");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const generateNonceStr = () => Math.random().toString(36).substring(2, 15);

const connectDB = async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  return client.db("tarot-station");
};

// WeChat sign generator
const createSign = (params, key) => {
  const stringA = Object.keys(params)
    .filter(k => k !== "sign" && params[k] !== undefined && params[k] !== "")
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&");
  const stringSignTemp = `${stringA}&key=${key}`;
  console.log("🔍 String to sign:", stringSignTemp);
  return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
};

// Build XML manually to avoid WeChat JSON escaping issues
const buildWeChatXML = (params) => {
  return `
<xml>
  <appid><![CDATA[${params.appid}]]></appid>
  <mch_id><![CDATA[${params.mch_id}]]></mch_id>
  <nonce_str><![CDATA[${params.nonce_str}]]></nonce_str>
  <body><![CDATA[${params.body}]]></body>
  <out_trade_no><![CDATA[${params.out_trade_no}]]></out_trade_no>
  <total_fee>${params.total_fee}</total_fee>
  <spbill_create_ip><![CDATA[${params.spbill_create_ip}]]></spbill_create_ip>
  <notify_url><![CDATA[${params.notify_url}]]></notify_url>
  <trade_type><![CDATA[${params.trade_type}]]></trade_type>
  <scene_info>${params.scene_info}</scene_info>
  <sign><![CDATA[${params.sign}]]></sign>
</xml>
  `.trim();
};

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const total_fee = body.total_fee || 1;
    const userId = (body.userId || "guest").toString();

    const shortUserId = userId.slice(0, 6);
    const out_trade_no = `U${shortUserId}${Date.now().toString().slice(-10)}`;

    // Config
    const appid = process.env.WECHAT_APPID;
    const mch_id = process.env.WECHAT_MCH_ID;
    const key = process.env.WECHAT_API_KEY;
    const notify_url = "https://backend-tarot-app.netlify.app/.netlify/functions/wechat-notify";
    const redirect_url = "https://tarotstation.com/payment-success";
    const trade_type = "MWEB";
    const ip = event.headers['x-forwarded-for']?.split(',')[0] || "8.8.8.8";

    // scene_info must be raw JSON
    const scene_info_json = JSON.stringify({
      h5_info: {
        type: "Wap",
        wap_url: "https://tarotstation.com",
        wap_name: "Tarot Wallet"
      }
    });

    const params = {
      appid,
      mch_id,
      nonce_str: generateNonceStr(),
      body: "Tarot Wallet Recharge",
      out_trade_no,
      total_fee: total_fee.toString(),
      spbill_create_ip: ip,
      notify_url,
      trade_type,
      scene_info: scene_info_json
    };

    const sign = createSign(params, key);
    params.sign = sign;

    const xmlData = buildWeChatXML(params);
    console.log("📤 XML sent to WeChat:\n", xmlData);

    const response = await axios.post(
      "https://api.mch.weixin.qq.com/pay/unifiedorder",
      xmlData,
      { headers: { "Content-Type": "text/xml; charset=utf-8" } }
    );

    const xml2js = require("xml2js");
    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    const result = parsed.xml;

    console.log("🟢 WeChat unifiedorder response:", result);

    if (result.return_code === "SUCCESS" && result.result_code === "SUCCESS") {
      const mweb_url = `${result.mweb_url}&redirect_url=${encodeURIComponent(redirect_url)}`;

      // Save order in DB
      const db = await connectDB();
      await db.collection("wechat_orders").insertOne({
        out_trade_no,
        userId,
        total_fee,
        status: "PENDING",
        createdAt: new Date()
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          paymentUrl: mweb_url,
          out_trade_no
        })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: result.return_msg || result.err_code_des || "WeChat error",
          raw: result
        })
      };
    }
  } catch (err) {
    console.error("❌ WeChat H5 Pay Error:", err.message || err, err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unexpected error" })
    };
  }
};




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
