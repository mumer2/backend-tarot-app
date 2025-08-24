// netlify/functions/query-order.js
const AlipaySdk = require("alipay-sdk").default;

const sdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.ALIPAY_PRIVATE_KEY,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
  gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipaydev.com/gateway.do",
  signType: "RSA2"
});

exports.handler = async (event) => {
  try {
    const outTradeNo = (event.queryStringParameters && event.queryStringParameters.outTradeNo) || "";
    if (!outTradeNo) return { statusCode: 400, body: "Missing outTradeNo" };

    const result = await sdk.exec("alipay.trade.query", {
      bizContent: { out_trade_no: outTradeNo }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result)
    };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
