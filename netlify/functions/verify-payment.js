function normalizePhone(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return p;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const secretKey = process.env.INSTASEND_SECRET_KEY;
  const pubKey = process.env.INSTASEND_PUBLISHABLE_KEY;

  if (!secretKey || !pubKey) {
    return {
      statusCode: 503, headers,
      body: JSON.stringify({ error: 'Payment system not configured. Contact administrator.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  try {
    // ── INITIATE STK PUSH ──────────────────────────────────────────
    if (body.action === 'initiate') {
      const { phone, amount, apiRef } = body;
      const normalizedPhone = normalizePhone(phone);

      console.log('Initiating STK Push:', { phone: normalizedPhone, amount, apiRef });

      const response = await fetch('https://payment.intasend.com/api/v1/payment/mpesa-stk-push/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-IntaSend-Public-Key': pubKey,
          'Authorization': 'Bearer ' + secretKey,
        },
        body: JSON.stringify({
          amount: Math.round(parseFloat(amount)),
          phone_number: normalizedPhone,
          currency: 'KES',
          narrative: 'EduManage Pro subscription',
          api_ref: apiRef || 'edumanage_' + Date.now(),
        }),
      });

      const text = await response.text();
      console.log('IntaSend status:', response.status, 'body:', text);

      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }

      const invoiceId = data.invoice_id || data.id;
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ ...data, invoice_id: invoiceId }),
      };
    }

    // ── CHECK PAYMENT STATUS ───────────────────────────────────────
    if (body.invoiceId) {
      console.log('Checking status for invoice:', body.invoiceId);

      const response = await fetch(`https://payment.intasend.com/api/v1/payment/status/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-IntaSend-Public-Key': pubKey,
          'Authorization': 'Bearer ' + secretKey,
        },
        body: JSON.stringify({ invoice_id: body.invoiceId }),
      });

      const text = await response.text();
      console.log('Status response:', text);

      let data;
      try { data = JSON.parse(text); } catch { data = {}; }

      const state = data.invoice?.state || data.state;
      return { statusCode: 200, headers, body: JSON.stringify({ state, ...data }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing action or invoiceId' }) };

  } catch (err) {
    console.error('verify-payment error:', err.message);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ error: true, message: err.message || 'Payment failed. Try again.' }),
    };
  }
};
