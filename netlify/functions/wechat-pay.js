// netlify/functions/wechat-create-order.js
const axios = require("axios");
const crypto = require("crypto");
const xml2js = require("xml2js");
const { MongoClient } = require("mongodb");
require("dotenv").config();

// ---- CONFIG (env) ----
const {
  MONGO_URI,
  WECHAT_APPID,
  WECHAT_MCH_ID,
  WECHAT_API_KEY,
} = process.env;

// ---- Reuse Mongo connection across cold starts ----
let cachedDb = null;
let cachedClient = null;
async function connectDB() {
  if (cachedDb && cachedClient) return cachedDb;
  if (!MONGO_URI) throw new Error("MONGO_URI is missing");
  cachedClient = new MongoClient(MONGO_URI, { maxPoolSize: 5 });
  await cachedClient.connect();
  cachedDb = cachedClient.db("tarot-station");
  return cachedDb;
}

// ---- Utils ----
const generateNonceStr = () => Math.random().toString(36).slice(2, 18);

function createSign(params, key) {
  // WeChat: sort keys ASC, exclude empty/undefined and 'sign' itself
  const stringA = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const stringSignTemp = `${stringA}&key=${key}`;
  return crypto
    .createHash("md5")
    .update(stringSignTemp, "utf8")
    .digest("hex")
    .toUpperCase();
}

function getClientIp(event) {
  const xf = event.headers?.["x-forwarded-for"] || event.headers?.["X-Forwarded-For"];
  const ip =
    (xf && xf.split(",")[0].trim()) ||
    event.requestContext?.identity?.sourceIp ||
    event.headers?.["x-real-ip"] ||
    "127.0.0.1";
  return ip;
}

// Build XML with explicit CDATA for specific fields
function buildWeChatXml(params, cdataFields = []) {
  const obj = { ...params };

  // Wrap CDATA fields
  for (const field of cdataFields) {
    if (obj[field] !== undefined && obj[field] !== null) {
      obj[field] = { _cdata: String(obj[field]) };
    }
  }

  const builder = new xml2js.Builder({
    rootName: "xml",
    headless: true,
    cdata: true, // allows {_cdata: "..."} usage
    renderOpts: { pretty: false },
  });

  return builder.buildObject(obj);
}

// ---- Main handler ----
exports.handler = async (event) => {
  const startedAt = Date.now();
  try {
    if (event.httpMethod && event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    // Basic env validation
    if (!WECHAT_APPID || !WECHAT_MCH_ID || !WECHAT_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "WeChat credentials not configured" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const total_fee_raw = body.total_fee;
    const userId = (body.userId || "guest").toString().trim();

    // Validate total_fee (WeChat expects amount in fen — integer)
    const total_fee = Number.isFinite(Number(total_fee_raw)) ? parseInt(total_fee_raw, 10) : NaN;
    if (!Number.isInteger(total_fee) || total_fee <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid total_fee (must be integer fen > 0)" }) };
    }

    const notify_url = "https://backend-tarot-app.netlify.app/.netlify/functions/wechat-notify";
    const redirect_url = "https://tarotstation.com/payment-success"; // must be whitelisted in WeChat MCH portal
    const trade_type = "MWEB";

    // out_trade_no: ensure uniqueness & <= 32 chars (WeChat limit)
    const shortUserId = userId.replace(/[^A-Za-z0-9]/g, "").slice(0, 6) || "GUEST";
    const out_trade_no_raw = `U${shortUserId}${Date.now().toString().slice(-10)}`;
    const out_trade_no = out_trade_no_raw.slice(0, 32);

    const spbill_create_ip = getClientIp(event);

    // scene_info must be valid JSON string
    const scene_info = JSON.stringify({
      h5_info: {
        type: "Wap",
        wap_url: "https://tarotstation.com",
        wap_name: "Tarot Wallet",
      },
    });

    // We sign on the STRING values WeChat expects (no CDATA wrappers in signature)
    const signParams = {
      appid: WECHAT_APPID,
      mch_id: WECHAT_MCH_ID,
      nonce_str: generateNonceStr(),
      body: "Tarot Wallet Recharge",
      out_trade_no,
      total_fee: String(total_fee),
      spbill_create_ip,
      notify_url,
      trade_type,
      scene_info,
    };

    const sign = createSign(signParams, WECHAT_API_KEY);

    // Build XML, applying CDATA to body & scene_info (and optionally others)
    const xmlData = buildWeChatXml(
      { ...signParams, sign },
      ["body", "scene_info"] // fields to wrap in CDATA
    );

    const http = axios.create({
      timeout: 15000,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      validateStatus: () => true, // we'll handle non-200 ourselves
    });

    const wxRes = await http.post("https://api.mch.weixin.qq.com/pay/unifiedorder", xmlData);
    if (wxRes.status !== 200) {
      throw new Error(`WeChat unifiedorder HTTP ${wxRes.status}`);
    }

    const parsed = await xml2js.parseStringPromise(wxRes.data, { explicitArray: false, trim: true });
    const result = parsed?.xml || {};
    const return_code = result.return_code;
    const result_code = result.result_code;

    // Log raw result (avoid printing secrets)
    console.log("🟢 WeChat unifiedorder response:", {
      return_code,
      result_code,
      return_msg: result.return_msg,
      err_code: result.err_code,
      err_code_des: result.err_code_des,
    });

    const db = await connectDB();
    const orders = db.collection("wechat_orders");

    if (return_code === "SUCCESS" && result_code === "SUCCESS" && result.mweb_url) {
      const mweb_url = `${result.mweb_url}&redirect_url=${encodeURIComponent(redirect_url)}`;

      // Save pending order
      await orders.insertOne({
        out_trade_no,
        userId,
        total_fee,
        currency: "CNY-fen",
        status: "PENDING",
        provider: "wechat_h5",
        requestIp: spbill_create_ip,
        createdAt: new Date(),
        diagnostics: {
          return_code,
          result_code,
        },
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          paymentUrl: mweb_url,
          out_trade_no,
        }),
      };
    }

    // Failure: persist for diagnostics
    const failure = {
      out_trade_no,
      userId,
      total_fee,
      status: "FAILED",
      provider: "wechat_h5",
      requestIp: spbill_create_ip,
      createdAt: new Date(),
      error: result.return_msg || result.err_code_des || "WeChat error",
      raw: {
        return_code,
        result_code,
        return_msg: result.return_msg || null,
        err_code: result.err_code || null,
        err_code_des: result.err_code_des || null,
      },
    };
    await orders.insertOne(failure);

    return {
      statusCode: 400,
      body: JSON.stringify({
        error: failure.error,
        out_trade_no,
        raw: failure.raw,
      }),
    };
  } catch (err) {
    console.error("❌ WeChat H5 Pay Error:", err?.message || err, err?.stack);
    try {
      const db = await connectDB();
      await db.collection("wechat_orders_errors").insertOne({
        at: new Date(),
        message: err?.message || String(err),
        stack: err?.stack || null,
      });
    } catch (dbErr) {
      console.error("⚠️ Failed to log error to DB:", dbErr?.message || dbErr);
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err?.message || "Unexpected error",
      }),
    };
  } finally {
    console.log(`⏱ handled in ${Date.now() - startedAt}ms`);
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
