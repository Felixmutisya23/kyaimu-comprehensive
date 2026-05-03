exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const key = process.env.INSTASEND_SECRET_KEY;
  const pubKey = process.env.INSTASEND_PUBLISHABLE_KEY || '';
  if (!key) {
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
    if (body.action === 'initiate') {
      const { phone, amount, apiRef, name, email } = body;
      console.log('Initiating payment:', { phone, amount, apiRef });

      const res = await fetch('https://api.intasend.com/api/v1/payment/mpesa-stk-push/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'X-intasend-public-key-token': pubKey,
        },
        body: JSON.stringify({
          amount: String(amount),
          phone_number: phone,
          api_ref: apiRef || 'edumanage-payment',
        }),
      });

      const text = await res.text();
      console.log('InstaSend status:', res.status, 'body:', text);

      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!res.ok) {
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ error: true, message: data?.detail || data?.message || `InstaSend error ${res.status}` }),
        };
      }
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (body.invoiceId) {
      const res = await fetch(
        `https://api.intasend.com/api/v1/payment/status/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({ invoice_id: body.invoiceId }),
        }
      );
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = {}; }
      return { statusCode: 200, headers, body: JSON.stringify({ state: data.invoice?.state || data.state }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing action or invoiceId' }) };

  } catch (err) {
    console.error('verify-payment error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ error: true, message: err.message }) };
  }
};
