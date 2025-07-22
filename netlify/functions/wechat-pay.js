const axios = require("axios");
const crypto = require("crypto");
const xml2js = require("xml2js");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const generateNonceStr = () => Math.random().toString(36).substring(2, 15);
const connectDB = async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  return client.db("tarot-station");
};

const createSign = (params, key) => {
  const stringA = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== "")
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&");
  const stringSignTemp = `${stringA}&key=${key}`;
  return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
};

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const total_fee = body.total_fee || 1;
    const userId = (body.userId || "guest").toString();

    const shortUserId = userId.slice(0, 6);
    const out_trade_no = `U${shortUserId}${Date.now().toString().slice(-10)}`;

    // ✅ CONFIG
    const appid = process.env.WECHAT_APPID;
    const mch_id = process.env.WECHAT_MCH_ID;
    const key = process.env.WECHAT_API_KEY;
    const notify_url = "https://backend-tarot.netlify.app/.netlify/functions/wechat-notify";
    const redirect_url = "https://your-success-url.com"; // Replace with your whitelisted domain
    const trade_type = "MWEB";

    const params = {
      appid,
      mch_id,
      nonce_str: generateNonceStr(),
      body: "Tarot Wallet Recharge",
      out_trade_no,
      total_fee: total_fee.toString(),
      spbill_create_ip: "127.0.0.1",
      notify_url,
      trade_type,
      scene_info: JSON.stringify({
        h5_info: {
          type: "Wap",
          wap_url: "https://yourdomain.com", // Replace with your site
          wap_name: "Tarot Wallet"
        }
      })
    };

    const sign = createSign(params, key);
    const builder = new xml2js.Builder({ rootName: "xml", headless: true, cdata: true });
    const xmlData = builder.buildObject({ ...params, sign });

    const response = await axios.post(
      "https://api.mch.weixin.qq.com/pay/unifiedorder",
      xmlData,
      { headers: { "Content-Type": "text/xml; charset=utf-8" } }
    );

    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    const result = parsed.xml;

    console.log("🟢 WeChat H5 Pay Response:", result);

    if (result.return_code === "SUCCESS" && result.result_code === "SUCCESS") {
      const mweb_url = `${result.mweb_url}&redirect_url=${encodeURIComponent(redirect_url)}`;

      // ✅ Save order to DB
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
    console.error("❌ WeChat H5 Pay Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message || "Unexpected error"
      })
    };
  }
};
