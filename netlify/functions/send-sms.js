exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { to, message, username, senderId } = JSON.parse(event.body || '{}');

    if (!to || !message) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required fields: to, message' }),
      };
    }

    // Use env var for API key — never exposed to frontend
    const apiKey = process.env.AT_API_KEY;
    const atUsername = username || process.env.AT_USERNAME || 'sandbox';
    const sender = senderId || process.env.AT_SENDER_ID || '';

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'AT_API_KEY not configured in Netlify environment' }),
      };
    }

    // Format phone numbers — ensure they start with 254 for Kenya
    const recipients = (Array.isArray(to) ? to : [to])
      .map(num => {
        const clean = String(num).replace(/\s+/g, '').replace(/^\+/, '');
        if (clean.startsWith('0')) return '254' + clean.slice(1);
        if (clean.startsWith('7') || clean.startsWith('1')) return '254' + clean;
        return clean; // already has country code
      })
      .join(',');

    const params = new URLSearchParams({
      username: atUsername,
      to: recipients,
      message,
      ...(sender ? { from: sender } : {}),
    });

    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': apiKey,
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    const data = await res.json();

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
