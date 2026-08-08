// IMPORTANT — domain and auth fix:
// The company is "IntaSend" (intasend.com) — this file was calling
// "app.instasend.io", a domain that does not exist (note the extra "s"
// and wrong TLD). That's exactly why every request failed at the
// network level with "fetch failed" — Node couldn't even resolve the
// hostname, let alone get a response. Confirmed the real domain and
// auth method directly against IntaSend's own developer docs
// (developers.intasend.com): live API base is https://payment.intasend.com,
// and requests must carry "Authorization: Bearer <secret key>" — NOT
// the "X-insta-token" header this file was sending.
const INTASEND_BASE = 'https://payment.intasend.com/api/v1';

export const handler = async (event) => {
  const method = event.httpMethod;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }

  if (method !== 'POST') {
    return { statusCode: 405, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    if (!process.env.INSTASEND_SECRET_KEY) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Payment gateway is not configured on the server (missing INSTASEND_SECRET_KEY). Contact the site owner.' }),
      };
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.INSTASEND_SECRET_KEY}`,
    };

    // ── INITIATE STK PUSH (POST with body.action = 'initiate') ────────
    // Uses the direct M-Pesa STK push endpoint (prompts the phone
    // immediately) rather than the "payment-links" checkout-link flow,
    // which generates a shareable URL instead — the app's UI expects an
    // immediate phone prompt, matching what "collection.mpesa_stk_push()"
    // does in IntaSend's own SDKs.
    if (body.action === 'initiate') {
      const { phone, amount, apiRef, name, email } = body;
      if (!phone || !amount) {
        return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Missing phone or amount.' }) };
      }

      const res = await fetch(`${INTASEND_BASE}/payment/mpesa-stk-push/`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amount,
          currency: 'KES',
          phone_number: phone,
          api_ref: apiRef,
          first_name: name,
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
          body: JSON.stringify({ error: (data && (data.detail || data.message || JSON.stringify(data))) || rawText || `IntaSend returned HTTP ${res.status}` }),
        };
      }

      // Normalize to the shape the frontend expects: json.invoice.invoice_id
      const invoiceId = data.invoice?.invoice_id || data.id || data.invoice_id;
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ invoice: { invoice_id: invoiceId, ...data.invoice }, raw: data }),
      };
    }

    // ── POLL STATUS (POST with body.invoiceId) ─────────────────────────
    const { invoiceId } = body;
    if (!invoiceId) {
      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Missing invoiceId.' }) };
    }

    const res = await fetch(
      `${INTASEND_BASE}/payment/status/${invoiceId}/`,
      { headers: authHeaders }
    );

    const rawText = await res.text();
    let data;
    try { data = JSON.parse(rawText); } catch { data = null; }

    if (!res.ok || !data) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: (data && (data.detail || data.message || JSON.stringify(data))) || rawText || `IntaSend returned HTTP ${res.status}` }),
      };
    }

    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ state: data.invoice?.state || data.state }) };

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
