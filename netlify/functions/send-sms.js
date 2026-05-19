/* ── Netlify Function: send-sms ─────────────────────────────────────
   Proxies SMS requests to Africa's Talking API server-side,
   avoiding CORS issues when called from the browser.
   
   POST body: { to, message, username, senderId, apiKey }
   to: comma-separated phone numbers e.g. "+254712345678,+254798765432"
─────────────────────────────────────────────────────────────────── */

exports.handler = async (event) => {
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
    return { statusCode: 405, body: 'Method Not Allowed' };
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

    // Use env var first, fall back to client-supplied key (for per-school keys)
    const key = process.env.AT_API_KEY || apiKey;
    const user = process.env.AT_USERNAME || username || 'sandbox';
    const sender = process.env.AT_SENDER_ID || senderId || 'SCHOOL';

    if (!key) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No API key configured. Set AT_API_KEY in Netlify environment variables or in SMS Settings.' }),
      };
    }

    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': key,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        username: user,
        to,
        message,
        from: sender,
      }).toString(),
    });

    const json = await res.json();

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(json),
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
