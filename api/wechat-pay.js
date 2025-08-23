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

    // ✅ Your WeChat Pay credentials from merchant account
    const mch_id = process.env.WECHAT_MCH_ID;
    const appid = process.env.WECHAT_APPID;
    const mch_key = process.env.WECHAT_API_KEY;
    const notify_url = process.env.WECHAT_NOTIFY_URL; // must be HTTPS
    const trade_type = "MWEB"; // H5 payment

    const out_trade_no = "ORD" + Date.now();

    // ✅ Payment parameters
    const params = {
      appid,
      mch_id,
      nonce_str: crypto.randomBytes(16).toString("hex"),
      body: "Tarot Order",
      out_trade_no,
      total_fee,
      spbill_create_ip: "127.0.0.1", // client IP
      notify_url,
      trade_type,
      scene_info: JSON.stringify({
        h5_info: {
          type: "Wap",
          wap_url: "https://yourdomain.com",
          wap_name: "Tarot Station",
        },
      }),
    };

    // ✅ Sign parameters
    const stringA = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    const stringSignTemp = `${stringA}&key=${mch_key}`;
    const sign = crypto
      .createHash("md5")
      .update(stringSignTemp, "utf8")
      .digest("hex")
      .toUpperCase();

    const xmlBody = `
      <xml>
        ${Object.keys(params)
          .map((key) => `<${key}>${params[key]}</${key}>`)
          .join("")}
        <sign>${sign}</sign>
      </xml>
    `;

    // ✅ Call WeChat unified order API
    const fetchRes = await fetch("https://api.mch.weixin.qq.com/pay/unifiedorder", {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xmlBody,
    });

    const textRes = await fetchRes.text();

    // ✅ Extract paymentUrl (mweb_url) from XML
    const match = textRes.match(/<mweb_url><!\[CDATA\[(.*?)\]\]><\/mweb_url>/);

    if (match) {
      return res.status(200).json({ paymentUrl: match[1] });
    } else {
      return res.status(400).json({ error: "WeChat Pay failed", details: textRes });
    }
  } catch (err) {
    console.error("WeChat Pay error:", err);
    return res.status(500).json({ error: "Server error", message: err.message });
  }
}
