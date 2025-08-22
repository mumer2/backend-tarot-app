// netlify/functions/alipay-notify.js
const AlipaySdk = require("alipay-sdk");
const qs = require("qs");

const alipay = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.APP_PRIVATE_KEY,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
  gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do",
  signType: "RSA2",
});

// Simple response helper
function textResponse(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    },
    body,
  };
}

exports.handler = async (event) => {
  try {
    // Alipay sends `application/x-www-form-urlencoded`
    const isForm =
      (event.headers["content-type"] ||
        event.headers["Content-Type"] ||
        "").includes("application/x-www-form-urlencoded");

    const bodyString = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body || "";

    const payload = isForm
      ? qs.parse(bodyString)
      : (() => {
          try {
            return JSON.parse(bodyString);
          } catch {
            return {};
          }
        })();

    // ✅ Verify signature
    const ok = alipay.checkNotifySign(payload);

    if (!ok) {
      console.warn("❌ Invalid Alipay notify sign:", payload);
      return textResponse("invalid sign", 400);
    }

    const tradeStatus = payload.trade_status;
    const outTradeNo = payload.out_trade_no;

    // ✅ Update your DB/order system here
    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
      console.log("✅ Payment success:", outTradeNo);
      // TODO: mark order as paid
    } else {
      console.log("ℹ️ Notify status:", tradeStatus, "for order:", outTradeNo);
    }

    // ✅ Alipay requires plain 'success' response
    return textResponse("success");
  } catch (err) {
    console.error("❌ notify error:", err);
    return textResponse("error", 500);
  }
};
