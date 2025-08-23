// /api/wechat-pay.js
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { total_fee, userId } = req.body;

    if (!total_fee || !userId) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    // ✅ Replace with your real WeChat credentials
    const appid = process.env.WECHAT_APPID;
    const mch_id = process.env.WECHAT_MCHID;
    const apiKey = process.env.WECHAT_API_KEY;

    const nonce_str = crypto.randomBytes(16).toString("hex");
    const out_trade_no = "order_" + Date.now();

    // Scene info (required for H5 pay)
    const scene_info = JSON.stringify({
      h5_info: {
        type: "Wap",
        wap_url: "https://yourdomain.com",  // replace with your site
        wap_name: "Tarot App Payment"
      }
    });

    // Parameters for unifiedorder
    const params = {
      appid,
      mch_id,
      nonce_str,
      body: "Tarot App Recharge",
      out_trade_no,
      total_fee: String(total_fee), // in fen
      spbill_create_ip: "127.0.0.1",
      notify_url: "https://yourdomain.com/api/wechat-notify",
      trade_type: "MWEB",
      scene_info
    };

    // Sort params for sign
    const stringA = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const stringSignTemp = stringA + "&key=" + apiKey;
    const sign = crypto.createHash("md5").update(stringSignTemp, "utf8").digest("hex").toUpperCase();

    const xml = `
      <xml>
        <appid>${appid}</appid>
        <mch_id>${mch_id}</mch_id>
        <nonce_str>${nonce_str}</nonce_str>
        <sign>${sign}</sign>
        <body>${params.body}</body>
        <out_trade_no>${out_trade_no}</out_trade_no>
        <total_fee>${total_fee}</total_fee>
        <spbill_create_ip>127.0.0.1</spbill_create_ip>
        <notify_url>${params.notify_url}</notify_url>
        <trade_type>MWEB</trade_type>
        <scene_info>${scene_info}</scene_info>
      </xml>
    `;

    // Call WeChat API
    const resp = await fetch("https://api.mch.weixin.qq.com/pay/unifiedorder", {
      method: "POST",
      body: xml,
    });

    const text = await resp.text();

    if (text.includes("<mweb_url>")) {
      const match = text.match(/<mweb_url><!\[CDATA\[(.*?)\]\]><\/mweb_url>/);
      if (match) {
        return res.status(200).json({ paymentUrl: match[1] });
      }
    }

    return res.status(500).json({ error: "WeChat Pay request failed", raw: text });
  } catch (err) {
    console.error("WeChat Pay Error:", err);
    return res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
}
