const IntaSend = require('intasend-node');

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
    const intasend = new IntaSend(pubKey, secretKey, false); // false = live mode
    const collection = intasend.collection();

    // ── INITIATE STK PUSH ──────────────────────────────────────────
    if (body.action === 'initiate') {
      const { phone, amount, apiRef, name, email } = body;
      const normalizedPhone = normalizePhone(phone);

      console.log('Initiating STK Push:', { phone: normalizedPhone, amount, apiRef });

      const response = await collection.mpesaStkPush({
        first_name: (name || 'School').split(' ')[0],
        last_name: (name || 'Admin').split(' ').slice(1).join(' ') || 'Admin',
        email: email || 'school@edumanage.ac.ke',
        host: 'https://elimupro-ke.netlify.app',
        amount: Math.round(parseFloat(amount)),
        phone_number: normalizedPhone,
        api_ref: apiRef || 'edumanage-payment',
      });

      console.log('STK Push response:', JSON.stringify(response));

      const invoiceId = response.invoice?.invoice_id || response.id;
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: true, invoice_id: invoiceId, ...response }),
      };
    }

    // ── CHECK PAYMENT STATUS ───────────────────────────────────────
    if (body.invoiceId) {
      console.log('Checking status for invoice:', body.invoiceId);
      const status = await collection.checkPayment({ invoice_id: body.invoiceId });
      console.log('Payment status:', JSON.stringify(status));
      const state = status.invoice?.state || status.state;
      return { statusCode: 200, headers, body: JSON.stringify({ state }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing action or invoiceId' }) };

  } catch (err) {
    console.error('verify-payment error:', err?.response?.data || err.message);
    const msg = err?.response?.data?.details || err?.response?.data?.detail || err.message;
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ error: true, message: msg || 'Payment failed. Try again.' }),
    };
  }
};
