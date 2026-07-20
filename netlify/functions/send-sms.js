/* ── Netlify Function: send-sms ─────────────────────────────────────
   Proxies SMS requests to Africa's Talking API server-side,
   avoiding CORS issues when called from the browser.

   POST body: { to, message, username, senderId, apiKey }
   to: comma-separated phone numbers e.g. "+254712345678,+254798765432"
─────────────────────────────────────────────────────────────────── */

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { to, message, username, senderId, apiKey } = JSON.parse(event.body || '{}');

    if (!to || !message) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required fields: to, message' }),
      };
    }

    // IMPORTANT: prefer whatever the school's admin actually configured in
    // the app's SMS Setup screen. This app is built for many schools, each
    // with their own Africa's Talking account/credentials entered through
    // the UI — a server-side env var should only ever be a fallback (e.g.
    // for a single-tenant deployment), never a silent override. The
    // previous version did env-var-first, which meant ANY leftover/
    // placeholder AT_API_KEY set in Netlify's environment variables would
    // silently override the real key the admin entered in the app, with
    // no indication why authentication kept failing.
    const key    = apiKey    || process.env.AT_API_KEY;
    const user   = username  || process.env.AT_USERNAME  || 'sandbox';
    // IMPORTANT: only pass `from` when a real Sender ID was actually
    // configured. The previous fallback of the literal string 'SCHOOL'
    // was NOT a real, registered Sender ID on anyone's account — sending
    // an unregistered alphanumeric sender is a common reason Africa's
    // Talking rejects the ENTIRE batch (Recipients: [] — nothing
    // processed, nothing in the Outbox, wallet untouched, yet the HTTP
    // call itself still "succeeds"). Omitting `from` entirely lets
    // Africa's Talking fall back to the account's own default route.
    const sender = senderId || process.env.AT_SENDER_ID || '';

    if (!key) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No API key configured. Enter one in the app under Parent SMS → SMS Setup.' }),
      };
    }

    const params = { username: user, to, message };
    if (sender) params.from = sender;

    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': key,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams(params).toString(),
    });

    // Africa's Talking doesn't always return JSON — auth failures and some
    // other errors come back as plain text (e.g. "The supplied
    // authentication is invalid"). Read the raw text first and only THEN
    // attempt to parse it, so we never throw here and always hand the
    // browser something valid to read, no matter what AT sends back.
    const rawText = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (!res.ok || !parsed) {
      // Surface AT's real message (JSON or plain text) clearly, with the
      // actual HTTP status, instead of letting a JSON.parse crash produce
      // a confusing generic error on the client.
      return {
        statusCode: 200, // 200 so the client can read the body; ok/error is inside the payload
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: (parsed && (parsed.error || parsed.message)) || rawText || `Africa's Talking returned HTTP ${res.status}`,
          atHttpStatus: res.status,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(parsed),
    };

  } catch (e) {
    return {
      statusCode: 200, // keep 200 so this is always readable JSON on the client
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
