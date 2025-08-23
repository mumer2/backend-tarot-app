import crypto from "crypto";
import { parseStringPromise } from "xml2js";
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { total_fee, userId } = req.body;
    if (!total_fee || !userId) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const appid = process.env.WECHAT_APPID;
    const mch_id = process.env.WECHAT_MCHID;
    const apiKey = process.env.WECHAT_API_KEY;
    const notify_url = process.env.WECHAT_NOTIFY_URL;

    const nonce_str = crypto.randomBytes(16).toString("hex");
    const out_trade_no = Date.now().toString();

    // Required params
    const params = {
      appid,
      mch_id,
      nonce_str,
      body: "Tarot Reading Service",
      out_trade_no,
      total_fee, // already in fen
      spbill_create_ip: "127.0.0.1",
      notify_url,
      trade_type: "MWEB",
      scene_info: JSON.stringify({
        h5_info: {
          type: "Wap",
          wap_url: "https://your-frontend-domain.com",
          wap_name: "Tarot Station",
        },
      }),
    };

    // Sign the request
    const stringA = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== "")
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const stringSignTemp = `${stringA}&key=${apiKey}`;
    const sign = crypto
      .createHash("md5")
      .update(stringSignTemp, "utf8")
      .digest("hex")
      .toUpperCase();

    // Build XML
    const xml = `<xml>
      ${Object.keys(params)
        .map((k) => `<${k}><![CDATA[${params[k]}]]></${k}>`)
        .join("")}
      <sign><![CDATA[${sign}]]></sign>
    </xml>`;

    // Call WeChat unifiedorder API
    const { data } = await axios.post(
      "https://api.mch.weixin.qq.com/pay/unifiedorder",
      xml,
      { headers: { "Content-Type": "text/xml" } }
    );

    // Parse XML response
    const result = await parseStringPromise(data, { explicitArray: false });

    if (
      result.xml.return_code === "SUCCESS" &&
      result.xml.result_code === "SUCCESS"
    ) {
      return res.json({ paymentUrl: result.xml.mweb_url });
    } else {
      return res
        .status(400)
        .json({ error: result.xml.err_code_des || "WeChat Pay failed" });
    }
  } catch (err) {
    console.error("WeChat Pay error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
