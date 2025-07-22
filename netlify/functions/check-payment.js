const axios = require("axios");
const xml2js = require("xml2js");
const crypto = require("crypto");
const connectDB = require("./utils/db");
const Wallet = require("./models/Wallet");

require("dotenv").config();

const generateNonceStr = () => Math.random().toString(36).substring(2, 15);

const buildSign = (params, key) => {
  const stringA = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  const stringSignTemp = `${stringA}&key=${key}`;
  return crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();
};

exports.handler = async (event) => {
  try {
    const { orderId } = event.queryStringParameters;

    if (!orderId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing orderId" }) };
    }

    const appid = process.env.WECHAT_APPID;
    const mch_id = process.env.WECHAT_MCH_ID;
    const key = process.env.WECHAT_API_KEY;

    const params = {
      appid,
      mch_id,
      nonce_str: generateNonceStr(),
      out_trade_no: orderId,
    };

    const sign = buildSign(params, key);

    const builder = new xml2js.Builder({ rootName: "xml", headless: true, cdata: true });
    const xmlData = builder.buildObject({ ...params, sign });

    const response = await axios.post("https://api.mch.weixin.qq.com/pay/orderquery", xmlData, {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });

    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    const result = parsed.xml;

    console.log("🟢 WeChat Query Result:", result);

    if (
      result.return_code === "SUCCESS" &&
      result.result_code === "SUCCESS" &&
      result.trade_state === "SUCCESS"
    ) {
      const userId = result.out_trade_no.substring(1, 7); // Extracted from orderId
      const amount = parseInt(result.total_fee) / 100;

      await connectDB();
      const wallet = await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { balance: amount },
          $push: { history: { amount, createdAt: new Date() } },
        },
        { upsert: true, new: true }
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ paid: true, amount, balance: wallet.balance }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ paid: false }),
    };
  } catch (err) {
    console.error("❌ WeChat Payment Check Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Server error" }),
    };
  }
};
