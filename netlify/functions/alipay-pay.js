// netlify/functions/create-order.js
import AlipaySdk from "alipay-sdk";
import qs from "qs";

const alipay = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.APP_PRIVATE_KEY,      // PKCS#8, with \n in env var
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
  gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do",
  signType: "RSA2"
});

// Helper CORS
function cors(body, status = 200, contentType = "application/json") {
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Content-Type": contentType
    },
    body: typeof body === "string" ? body : JSON.stringify(body)
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors("");

  try {
    const { amount = "9.99", subject = "Tarot Reading" } =
      event.httpMethod === "POST"
        ? JSON.parse(event.body || "{}")
        : (event.queryStringParameters || {});

    const outTradeNo = `ORDER_${Date.now()}`;

    // Parameters for WAP pay
    const params = {
      method: "alipay.trade.wap.pay",
      return_url: process.env.RETURN_URL, // deep link or https page
      notify_url: `${process.env.PUBLIC_BASE_URL}/.netlify/functions/alipay-notify`,
      bizContent: {
        out_trade_no: outTradeNo,
        product_code: "QUICK_WAP_WAY",
        total_amount: String(amount),
        subject,
        quit_url: `${process.env.PUBLIC_BASE_URL}/pay/cancel`
      }
    };

    let url;

    // Some alipay-sdk versions expose pageExecute; if not, fall back to exec.
    if (typeof alipay.pageExecute === "function") {
      const r = await alipay.pageExecute(params);
      url = typeof r === "string" ? r : r?.url;
    } else {
      const signed = await alipay.exec("alipay.trade.wap.pay", params);
      url = `${process.env.ALIPAY_GATEWAY}?${signed}`;
    }

    if (!url) throw new Error("Failed to build Alipay URL");

    return cors({ url, out_trade_no: outTradeNo });
  } catch (err) {
    console.error("create-order error:", err);
    return cors({ error: String(err?.message || err) }, 500);
  }
};
