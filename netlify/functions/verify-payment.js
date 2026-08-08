export const handler = async (event) => {
  const method = event.httpMethod;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }

  if (method !== 'POST') {
    return { statusCode: 405, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Method Not Allowed' };
  }

  // Everything below used to have NO error handling at all — any hiccup
  // from InstaSend (timeout, non-JSON response, wrong/missing API key,
  // their service being briefly down) caused an unhandled exception,
  // which Netlify reports to the browser as a raw, unreadable
  // "502 Bad Gateway" with zero information about what actually went
  // wrong. Wrapping this in try/catch means a real failure reason
  // reaches the app instead — for BOTH the license/subscription flow
  // and the Schemes of Work flow, since they share this same function.
  try {
    const body = JSON.parse(event.body || '{}');

    if (!process.env.INSTASEND_SECRET_KEY) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Payment gateway is not configured on the server (missing INSTASEND_SECRET_KEY). Contact the site owner.' }),
      };
    }

    // ── INITIATE STK PUSH (POST with body.action = 'initiate') ────────
    if (body.action === 'initiate') {
      const { phone, amount, apiRef, name, email } = body;
      if (!phone || !amount) {
        return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Missing phone or amount.' }) };
      }

      const res = await fetch('https://app.instasend.io/api/v1/payment-links/one-time/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-insta-token': process.env.INSTASEND_SECRET_KEY,
        },
        body: JSON.stringify({
          amount,
          currency: 'KES',
          phone_number: phone,
          api_ref: apiRef,
          name,
          email,
        }),
      });

      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); } catch { data = null; }

      if (!res.ok || !data) {
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: (data && (data.detail || data.message)) || rawText || `InstaSend returned HTTP ${res.status}` }),
        };
      }

      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
    }

    // ── POLL STATUS (POST with body.invoiceId) ─────────────────────────
    const { invoiceId } = body;
    if (!invoiceId) {
      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Missing invoiceId.' }) };
    }

    const res = await fetch(
      `https://app.instasend.io/api/v1/payment-links/${invoiceId}/`,
      { headers: { 'X-insta-token': process.env.INSTASEND_SECRET_KEY } }
    );

    const rawText = await res.text();
    let data;
    try { data = JSON.parse(rawText); } catch { data = null; }

    if (!res.ok || !data) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: (data && (data.detail || data.message)) || rawText || `InstaSend returned HTTP ${res.status}` }),
      };
    }

    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ state: data.invoice?.state }) };

  } catch (e) {
    // Last-resort catch — guarantees the browser NEVER sees a raw 502
    // again from this function; it always gets readable JSON instead.
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Payment service error: ' + e.message }),
    };
  }
};
