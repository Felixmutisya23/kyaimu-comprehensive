exports.handler = async (event) => {
  const method = event.httpMethod;

  // ── INITIATE STK PUSH (POST with body.action = 'initiate') ──────────
  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');

    if (body.action === 'initiate') {
      const { phone, amount, apiRef, name, email } = body;
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
      const data = await res.json();
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(data),
      };
    }

    // ── POLL STATUS (POST with body.invoiceId) ────────────────────────
    const { invoiceId } = body;
    const res = await fetch(
      `https://app.instasend.io/api/v1/payment-links/${invoiceId}/`,
      {
        headers: { 'X-insta-token': process.env.INSTASEND_SECRET_KEY },
      }
    );
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ state: data.invoice?.state }),
    };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
