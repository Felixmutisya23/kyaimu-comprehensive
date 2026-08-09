// IMPORTANT — verified directly against IntaSend's official OpenAPI spec
// (developers.intasend.com/llms.txt → reference pages), since the SDK
// docs alone don't show raw REST paths:
//   - Server is https://api.intasend.com (NOT payment.intasend.com,
//     and NOT app.instasend.io, which never existed at all)
//   - Status check is a POST to /api/v1/payment/status/ with
//     { invoice_id } in the JSON BODY — not a GET with the id in the
//     URL path. This was the exact bug behind payments not being
//     detected as complete: the previous status check was malformed
//     (wrong method AND wrong request shape), so it was very likely
//     failing or returning nothing usable every single time it polled,
//     regardless of whether the real M-Pesa payment had gone through.
const INTASEND_BASE = 'https://api.intasend.com/api/v1';

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
    // Request body matches the MPesaSTKPushInit schema exactly: only
    // amount, phone_number, and api_ref are real fields on this
    // endpoint — currency/first_name/email (sent previously) aren't
    // part of this schema at all.
    if (body.action === 'initiate') {
      const { phone, amount, apiRef } = body;
      if (!phone || !amount) {
        return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Missing phone or amount.' }) };
      }

      const res = await fetch(`${INTASEND_BASE}/payment/mpesa-stk-push/`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amount,
          phone_number: phone,
          api_ref: apiRef,
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

      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
    }

    // ── POLL STATUS (POST with body.invoiceId) ─────────────────────────
    const { invoiceId } = body;
    if (!invoiceId) {
      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Missing invoiceId.' }) };
    }

    const res = await fetch(`${INTASEND_BASE}/payment/status/`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ invoice_id: invoiceId }),
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
