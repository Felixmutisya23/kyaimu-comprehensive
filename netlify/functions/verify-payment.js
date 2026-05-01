exports.handler = async (event) => {
  const { invoiceId } = JSON.parse(event.body);

  const res = await fetch(
    `https://app.instasend.io/api/v1/payment-links/${invoiceId}/`,
    {
      headers: {
        'X-insta-token': process.env.INSTASEND_SECRET_KEY,
      },
    }
  );

  const data = await res.json();

  return {
    statusCode: 200,
    body: JSON.stringify({ state: data.invoice?.state }),
  };
};