// netlify/functions/alipay-notify.js
import AlipaySdk from "alipay-sdk";
import qs from "qs";

const alipay = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.APP_PRIVATE_KEY,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
  gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipaydev.com/gateway.do",
  signType: "RSA2"
});

export const handler = async (event) => {
  // Alipay posts with application/x-www-form-urlencoded
  const isForm = (event.headers["content-type"] || event.headers["Content-Type"] || "").includes("application/x-www-form-urlencoded");

  const bodyString = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
  const payload = isForm ? qs.parse(bodyString) : (() => {
    try { return JSON.parse(bodyString); } catch { return {}; }
  })();

  try {
    const ok = await alipay.checkNotifySign(payload);

    if (!ok) {
      console.warn("Invalid Alipay notify sign:", payload);
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain" },
        body: "invalid sign"
      };
    }

    const tradeStatus = payload.trade_status;
    const outTradeNo = payload.out_trade_no;

    // TODO: update your DB by outTradeNo
    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
      console.log("Payment success:", outTradeNo);
      // mark order paid in your storage
    } else {
      console.log("Notify status:", tradeStatus, "for", outTradeNo);
    }

    // Per Alipay spec, respond with plain text 'success' when processed
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain" },
      body: "success"
    };
  } catch (err) {
    console.error("notify error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "error"
    };
  }
};
