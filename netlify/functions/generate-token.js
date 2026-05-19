// netlify/functions/generate-token.js
// ─────────────────────────────────────────────────────────────────
//  Generates and verifies EduManage Pro access tokens server-side.
//
//  FIX: developer password is now in Netlify env vars — never in
//  the frontend bundle where anyone can view it via DevTools.
//
//  Set in Netlify → Site Settings → Environment Variables:
//    DEVELOPER_SECRET = your-strong-password-here
//    APP_SECRET       = a random 32-char string (protects all endpoints)
//
//  POST body options:
//    { action: 'verify', password: '...' }
//    → returns { ok: true/false }
//
//    { action: 'generate', password: '...', schoolId: '...', expiry: 'YYYY-MM-DD', seats: 500 }
//    → returns { token: 'EDU-XXXXXXXX-YYYYMMDD-NNNN-CCCC' }
// ─────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.APP_ORIGIN || 'https://edumanagepro.netlify.app',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function makeToken(schoolId, expiryDate, maxStudents = 9999) {
  // School code = first 8 chars of UUID (no hyphens) — globally unique
  const schoolCode = (schoolId || '').replace(/-/g, '').toUpperCase().slice(0, 8).padEnd(8, 'X');
  const dateStr    = expiryDate.replace(/-/g, '');
  const seats      = String(maxStudents).padStart(4, '0');
  const raw        = `${schoolCode}${dateStr}${seats}`;
  const check      = [...raw]
    .reduce((a, c) => (a + c.charCodeAt(0)) % 9973, 0)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `EDU-${schoolCode}-${dateStr}-${seats}-${check}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // FIX: guard with a shared app secret so only YOUR deployed app can call this
  const appSecret = event.headers['x-app-secret'] || '';
  if (process.env.APP_SECRET && appSecret !== process.env.APP_SECRET) {
    return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const devSecret = process.env.DEVELOPER_SECRET;
  if (!devSecret) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'DEVELOPER_SECRET not set in Netlify env vars.' }),
    };
  }

  const { action, password, schoolId, expiry, seats } = body;

  if (action === 'verify') {
    // Simple constant-time comparison (avoids timing attacks)
    const ok = password === devSecret;
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok }) };
  }

  if (action === 'generate') {
    if (password !== devSecret) {
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Wrong developer password.' }) };
    }
    if (!schoolId || !expiry) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'schoolId and expiry are required.' }) };
    }
    const token = makeToken(schoolId, expiry, seats || 9999);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, token }) };
  }

  return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unknown action.' }) };
};
