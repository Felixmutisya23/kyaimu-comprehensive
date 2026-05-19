// netlify/functions/send-whatsapp.js
// ─────────────────────────────────────────────────────────────────
// Sends WhatsApp messages via Africa's Talking WhatsApp API.
// Requires Meta Business Account approval + AT WhatsApp API access.
//
// Set these in Netlify → Site Settings → Environment Variables:
//   AT_WA_API_KEY   = your Africa's Talking WhatsApp API key
//   AT_WA_PHONE_ID  = your WhatsApp sender phone number ID
//   AT_USERNAME     = your Africa's Talking username
//
// Template names used:
//   broadcast_message  → for general broadcast messages
//   exam_results       → for individual student results
//
// Submit these templates for Meta approval in your Business Manager
// before going live. During development, free-form text works within
// the 24-hour customer service window.
// ─────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { phone, message, templateName } = body;

  if (!phone || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'phone and message are required' }) };
  }

  const apiKey   = process.env.AT_WA_API_KEY  || '';
  const phoneId  = process.env.AT_WA_PHONE_ID || '';
  const username = process.env.AT_USERNAME    || 'sandbox';

  if (!apiKey || !phoneId) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: false,
        error: 'WhatsApp API not configured. Set AT_WA_API_KEY and AT_WA_PHONE_ID in Netlify environment variables.',
      }),
    };
  }

  try {
    // Africa's Talking WhatsApp API endpoint
    const res = await fetch('https://chat.africastalking.com/whatsapp/message', {
      method: 'POST',
      headers: {
        'apiKey':       apiKey,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify({
        username,
        productId: phoneId,
        channel:   'whatsapp',
        to:        phone,
        type:      'text',
        text: {
          body: message,
        },
        // For template messages (required for business-initiated outside 24hr window):
        // Uncomment and configure after Meta template approval:
        // template: {
        //   name: templateName,
        //   language: { code: 'en' },
        //   components: [{ type: 'body', parameters: [{ type: 'text', text: message }] }],
        // },
      }),
    });

    const json = await res.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: res.ok, raw: json }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: e.message }),
    };
  }
};
