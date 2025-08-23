// api/wechat-pay.js
import crypto from "crypto";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { total_fee, userId } = req.body;

    if (!total_fee || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Replace with your real WeChat Pay credentials
    const appId = process.env.WECHAT_APP_ID;
    const mchId = process.env.WECHAT_MCH_ID;
    const apiKey = process.env.WECHAT_API_KEY;
    const notifyUrl = process.env.WECHAT_NOTIFY_URL;

    // Unique order ID
    const out_trade_no = `${userId}_${Date.now()}`;

    // WeChat H5 payment params
    const params = {
      appid: appId,
      mch_id: mchId,
      nonce_str: crypto.randomBytes(16).toString("hex"),
      body: "Recharge",
      out_trade_no,
      total_fee,
      spbill_create_ip: "127.0.0.1",
      notify_url: notifyUrl,
      trade_type: "MWEB", // H5
      scene_info: JSON.stringify({
        h5_info: { type: "Wap", wap_url: "https://tarotstation.netlify.app/", wap_name: "Recharge" },
      }),
    };

    // ✅ Generate sign
    const stringA = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const stringSignTemp = stringA + `&key=${apiKey}`;
    const sign = crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();

    params.sign = sign;

    // ✅ Convert params to XML
    const xmlData = `<xml>
      ${Object.keys(params)
        .map((k) => `<${k}>${params[k]}</${k}>`)
        .join("")}
    </xml>`;

    // ✅ Call WeChat unifiedorder API
    const fetchRes = await fetch("https://api.mch.weixin.qq.com/pay/unifiedorder", {
      method: "POST",
      body: xmlData,
      headers: { "Content-Type": "text/xml" },
    });

    const textRes = await fetchRes.text();

    // ✅ Extract mweb_url
    const match = textRes.match(/<mweb_url><!\[CDATA\[(.*?)\]\]><\/mweb_url>/);

    if (match && match[1]) {
      return res.status(200).json({ paymentUrl: match[1] });
    } else {
      return res.status(400).json({ error: "Missing payment URL in response", raw: textRes });
    }
  } catch (err) {
    console.error("WeChat Pay Error:", err);
    return res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}
