const crypto = require('crypto');
const fs = require('fs');
const qs = require('querystring');

exports.handler = async (event) => {
  try {
    const { amount, userId } = JSON.parse(event.body);
    if (!amount || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing amount or userId' })
      };
    }

    const params = {
      app_id: 'YOUR_ALIPAY_APP_ID',
      method: 'alipay.trade.wap.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      version: '1.0',
      notify_url: 'https://your.domain/alipay-notify',
      return_url: 'https://your.domain/alipay-return',
      biz_content: JSON.stringify({
        subject: 'Recharge_' + userId,
        out_trade_no: `${userId}_${Date.now()}`,
        total_amount: amount.toFixed(2),
        product_code: 'QUICK_WAP_WAY'
      })
    };

    const signString = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    const privateKey = fs.readFileSync('./alipay_priv.pem', 'utf8');
    const sign = crypto.createSign('RSA-SHA256').update(signString).sign(privateKey, 'base64');
    const url = `https://openapi.alipay.com/gateway.do?${qs.stringify({ ...params, sign })}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ paymentUrl: url })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Alipay error', details: error.message })
    };
  }
};