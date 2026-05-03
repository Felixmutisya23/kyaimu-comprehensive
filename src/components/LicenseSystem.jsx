import React, { useState } from 'react';
import { supabaseClient } from '../supabase';

/* ═══════════════════════════════════════════════════════
   LICENSE & SUBSCRIPTION SYSTEM
   ─────────────────────────────────────────────────────
   • Each term: KES 100 per registered student
   • Payment via InstaSend (M-Pesa STK push)
   • Token system: developer-generated codes for time-limited access
   • Read-only mode if unpaid (data always preserved)
   • Offline: license status cached in localStorage
   • Auto-detects payment every 5 seconds — no manual confirmation
═══════════════════════════════════════════════════════ */

// ── YOUR INSTASEND KEYS (secret key in Netlify env vars only) ───────
// INSTASEND_PUBLIC_KEY is no longer needed in frontend — all API calls
// go through /.netlify/functions/verify-payment (server-side, secret key only)
// ⚠️  Set INSTASEND_SECRET_KEY in Netlify → Site Settings → Environment Variables

// ── API PROXY (Netlify function — avoids CORS) ───────
const VERIFY_PAYMENT_URL = '/.netlify/functions/verify-payment';

// ── PRICING CONSTANTS ────────────────────────────────
const FIRST_TERM_FLAT_FEE = 1000;  // KES 1,000 flat for first-ever term (testing)
const PER_STUDENT_FEE     = 100;   // KES 100 per student per term from next term onward

// ── STORAGE KEYS ─────────────────────────────────────
const LICENSE_STORAGE_KEY = 'edumanage_license_v1';
const TOKEN_STORAGE_KEY   = 'edumanage_token_v1';

/* ═══════════════════════════════════════════════════════
   TOKEN SYSTEM
   Format: EDU-XXXX-YYYYMMDD-NNNN-CCCC
   • XXXX = first 4 letters of school name
   • YYYYMMDD = expiry date
   • NNNN = max students (padded to 4 digits)
   • CCCC = checksum (prevents tampering)
═══════════════════════════════════════════════════════ */
function schoolHash(schoolName) {
  // Generate a 4-char hash from full school name — harder to guess than first 4 letters
  const name = schoolName.trim().toUpperCase();
  const hash = [...name].reduce((a, c, i) => (a + c.charCodeAt(0) * (i + 7)) % 46655, 0);
  return hash.toString(36).toUpperCase().padStart(4, '0');
}

function makeToken(schoolName, expiryDate, maxStudents = 9999) {
  const schoolCode = schoolHash(schoolName);
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

function parseToken(token) {
  try {
    const parts = token.trim().toUpperCase().split('-');
    if (parts.length !== 5 || parts[0] !== 'EDU') return null;
    const [, schoolCode, dateStr, seats, check] = parts;
    const raw = `${schoolCode}${dateStr}${seats}`;
    const expectedCheck = [...raw]
      .reduce((a, c) => (a + c.charCodeAt(0)) % 9973, 0)
      .toString(36)
      .toUpperCase()
      .padStart(4, '0');
    if (check !== expectedCheck) return null;
    const year  = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day   = parseInt(dateStr.slice(6, 8));
    const expiry = new Date(year, month, day, 23, 59, 59);
    if (isNaN(expiry.getTime())) return null;
    return { expiry, maxStudents: parseInt(seats), schoolCode, valid: true };
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════
   LICENSE STATE — persisted in Supabase (syncs across devices)
   Falls back to localStorage for speed on same device
═══════════════════════════════════════════════════════ */
function loadLicense() {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { paid: false, paidUntil: null, term: null, year: null, txRef: null, studentCount: 0 };
}

function saveLicense(lic, schoolId, tokenState) {
  try { localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(lic)); } catch {}
  saveLicenseToCloud(schoolId, lic, tokenState);
}

function loadTokenState() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (raw) {
      const t = JSON.parse(raw);
      if (t.expiry && new Date(t.expiry) > new Date()) return t;
    }
  } catch {}
  return null;
}

// Save license data to Supabase so it syncs across all devices
async function saveLicenseToCloud(schoolId, licData, tokenData) {
  if (!schoolId) return;
  try {
    await supabaseClient.from('schools').update({
      license_data: { lic: licData, token: tokenData }
    }).eq('id', schoolId);
  } catch(e) { console.warn('Cloud license save failed:', e); }
}

function saveTokenState(state, schoolId, licState) {
  try { localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(state)); } catch {}
  saveLicenseToCloud(schoolId, licState, state);
}

/* ═══════════════════════════════════════════════════════
   useLicense HOOK — used in App.jsx
═══════════════════════════════════════════════════════ */
export function useLicense(data, refreshKey = 0) {
  const studentCount = (data.students || []).filter(
    s => !s.status || s.status === 'active'
  ).length;

  // First term ever (no students yet) → flat KES 5,000; thereafter KES 100/student
  const isFirstTerm = studentCount === 0;
  const totalDue    = isFirstTerm ? FIRST_TERM_FLAT_FEE : studentCount * PER_STUDENT_FEE;

  // Track partial payments so we can show remaining balance
  // refreshKey changes after login to force re-read from localStorage (which was just updated from cloud)
  const [lic, setLicRaw]     = useState(() => loadLicense());
  const [tokenState, setTok] = useState(() => loadTokenState());

  React.useEffect(() => {
    if (refreshKey > 0) {
      setLicRaw(loadLicense());
      setTok(loadTokenState());
    }
  }, [refreshKey]);

  const _currentTerm = data.currentTerm || (new Date().getMonth() < 4 ? 1 : new Date().getMonth() < 8 ? 2 : 3);
  const _currentYear = data.currentYear || new Date().getFullYear();
  const alreadyPaid  = (lic.term === _currentTerm && lic.year === _currentYear)
    ? (lic.amountPaid || 0) : 0;
  const amountDue    = Math.max(0, totalDue - alreadyPaid);
  const [checking, setChecking] = useState(false);

  function setLic(val) { setLicRaw(val); saveLicense(val, data._schoolId, tokenState); }

  const currentTerm = _currentTerm;
  const currentYear = _currentYear;

  const tokenActive  = tokenState && new Date(tokenState.expiry) > new Date();
  const licenseValid = amountDue === 0 && lic.paid &&
    lic.term === currentTerm &&
    lic.year === currentYear;

  const isUnlocked = tokenActive || licenseValid;
  const daysLeft   = tokenActive
    ? Math.ceil((new Date(tokenState.expiry) - new Date()) / 86400000)
    : null;

  function applyToken(tokenStr) {
    const parsed = parseToken(tokenStr);
    if (!parsed) return { ok: false, msg: '❌ Invalid token. Please check and try again.' };
    if (parsed.expiry < new Date()) return { ok: false, msg: '❌ This token has already expired.' };
    // Verify token belongs to THIS school — prevents sharing between schools
    const expectedCode = schoolHash(data.schoolName || '');
    if (parsed.schoolCode !== expectedCode) {
      return { ok: false, msg: '❌ This token was generated for a different school and cannot be used here.' };
    }
    const state = {
      expiry: parsed.expiry.toISOString(),
      maxStudents: parsed.maxStudents,
      schoolCode: parsed.schoolCode,
    };
    setTok(state); saveTokenState(state, data._schoolId, lic);
    return { ok: true, msg: `✅ Token accepted! Access granted until ${parsed.expiry.toLocaleDateString('en-KE')}.` };
  }

  async function initiatePayment(phone, onSuccess) {
    if (!phone.trim()) { alert('Please enter your M-Pesa phone number.'); return; }
    if (amountDue <= 0) { alert('No outstanding balance. You are fully paid up!'); return; }
    setChecking(true);

    // Format: 254XXXXXXXXX
    let fp = phone.replace(/\s/g, '').replace(/^0/, '254');
    if (!fp.startsWith('254')) fp = '254' + fp;

    try {
      // ✅ Route through Netlify function — avoids CORS and keeps secret key server-side
      const res = await fetch(VERIFY_PAYMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate',
          phone: fp,
          amount: amountDue,
          apiRef: `EDU-${(data.schoolName || 'SCH').slice(0, 8).replace(/\s/g, '')}-T${currentTerm}-${currentYear}-${Date.now()}`,
          name: data.schoolName || 'School',
          email: data.principalEmail || 'school@school.ac.ke',
        }),
      });
      const json = await res.json();
      if (json.invoice?.invoice_id) {
        pollPayment(json.invoice.invoice_id, amountDue, onSuccess);
      } else {
        alert(`Payment initiation failed: ${json.message || json.detail || 'Unknown error'}\n\nCheck your phone number and try again.`);
        setChecking(false);
      }
    } catch {
      alert('Network error. Check your internet connection and try again.');
      setChecking(false);
    }
  }

  async function pollPayment(invoiceId, paidAmount, onSuccess) {
    let attempts = 0;
    const maxAttempts = 36; // 3 minutes

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(VERIFY_PAYMENT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId }),
        });
        const json = await res.json();
        const status = json.state?.toLowerCase();

        if (status === 'complete' || status === 'paid') {
          clearInterval(interval);
          setChecking(false);
          const newAmountPaid = alreadyPaid + paidAmount;
          const nowFullyPaid  = newAmountPaid >= totalDue;
          const newLic = {
            paid: nowFullyPaid,
            paidUntil: null,
            term: currentTerm,
            year: currentYear,
            txRef: invoiceId,
            studentCount,
            amountPaid: newAmountPaid,
            totalDue,
            paidAt: new Date().toISOString(),
          };
          setLic(newLic);
          if (onSuccess) onSuccess();
          if (nowFullyPaid) {
            alert(
              `✅ Payment confirmed!\n\nKES ${paidAmount.toLocaleString()} received.\n` +
              `System unlocked for Term ${currentTerm} ${currentYear}.\n\nTransaction: ${invoiceId}`
            );
          } else {
            const remaining = totalDue - newAmountPaid;
            alert(
              `✅ Payment of KES ${paidAmount.toLocaleString()} received!\n\n` +
              `⚠️ Balance remaining: KES ${remaining.toLocaleString()}\n` +
              `Total required: KES ${totalDue.toLocaleString()}\n\n` +
              `Please pay the remaining balance to unlock full access.`
            );
          }
        } else if (status === 'failed' || status === 'cancelled') {
          clearInterval(interval);
          setChecking(false);
          alert('Payment failed or cancelled. Please try again or use a Token.');
        }
      } catch {}

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setChecking(false);
        alert(
          'Payment check timed out.\n\n' +
          'If you completed the M-Pesa payment, contact the developer with your M-Pesa confirmation SMS.'
        );
      }
    }, 5000);
  }

  return {
    isUnlocked, licenseValid, tokenActive, daysLeft,
    checking, amountDue, totalDue, alreadyPaid, isFirstTerm, studentCount, currentTerm, currentYear,
    lic, applyToken, initiatePayment,
  };
}

/* ═══════════════════════════════════════════════════════
   LICENSE GATE UI — full screen overlay when unpaid
═══════════════════════════════════════════════════════ */
export function LicenseGate({ license, data }) {
  const [phone, setPhone]   = useState('');
  const [token, setToken]   = useState('');
  const [tokMsg, setTokMsg] = useState('');
  const [tab, setTab]       = useState('pay');

  function submitToken() {
    const result = license.applyToken(token);
    setTokMsg(result.msg);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      {/* Hidden dev trigger — tiny dot in bottom-right corner, invisible unless you know it's there */}
      <div
        title=""
        onClick={() => {
          // Dispatch a custom event that App.jsx listens for
          window.dispatchEvent(new CustomEvent('felix-dev-open'));
        }}
        style={{ position: 'fixed', bottom: 8, right: 8, width: 12, height: 12, borderRadius: '50%', background: '#7c3aed22', cursor: 'pointer', zIndex: 10000 }}
      />
      <div style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 20, padding: 40, maxWidth: 500, width: '92%', textAlign: 'center', boxShadow: '0 24px 80px #0008' }}>

        <div style={{ fontSize: 48, marginBottom: 10 }}>🏫</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4f8ef7', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
          {data.schoolName || 'EduManage Pro'}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>
          Subscription Required
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.8 }}>
          Term {license.currentTerm} · {license.currentYear}<br />
          <span style={{ fontSize: 28, fontWeight: 900, color: '#10b981' }}>
            KES {license.amountDue.toLocaleString()}
          </span><br />
          {license.isFirstTerm
            ? <span style={{ fontSize: 12 }}>First-term flat fee (no students enrolled yet)</span>
            : <span style={{ fontSize: 12 }}>{license.studentCount} students × KES 100 per term</span>
          }
          {license.alreadyPaid > 0 && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#f59e0b15', borderRadius: 8, border: '1px solid #f59e0b30', fontSize: 12 }}>
              ⚠️ <strong style={{ color: '#f59e0b' }}>Partial payment:</strong> KES {license.alreadyPaid.toLocaleString()} paid &nbsp;·&nbsp;
              <strong style={{ color: '#ef4444' }}>Balance: KES {license.amountDue.toLocaleString()}</strong> of KES {license.totalDue.toLocaleString()} total
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#0f1117', borderRadius: 10, padding: 4 }}>
          {[['pay', '📱 Pay via M-Pesa'], ['token', '🔑 Use Token']].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', borderRadius: 7, border: 'none',
              background: tab === t ? '#4f8ef7' : 'transparent',
              color: tab === t ? '#fff' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>

        {/* Pay tab */}
        {tab === 'pay' && (
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>M-Pesa Phone Number</label>
            <input
              value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && license.initiatePayment(phone, null)}
              placeholder="0712 345 678" type="tel"
              style={{ width: '100%', padding: '12px 14px', marginBottom: 14, background: '#0f1117', border: '1px solid #2a3350', borderRadius: 10, color: '#e2e8f0', fontSize: 16, boxSizing: 'border-box', letterSpacing: 1 }}
            />
            <button
              onClick={() => license.initiatePayment(phone, null)}
              disabled={license.checking || !phone.trim()}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: license.checking ? '#1e2435' : 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: license.checking ? 'not-allowed' : 'pointer' }}>
              {license.checking ? '⏳ Waiting for M-Pesa confirmation...' : `Pay KES ${license.amountDue.toLocaleString()} via M-Pesa`}
            </button>
            {license.checking && (
              <div style={{ marginTop: 14, padding: 14, background: '#f59e0b10', borderRadius: 10, fontSize: 13, color: '#f59e0b', border: '1px solid #f59e0b25', lineHeight: 1.7 }}>
                📱 <strong>Check your phone now.</strong><br />
                Enter your M-Pesa PIN on the prompt.<br />
                This screen will unlock <strong>automatically</strong> once payment is confirmed.
              </div>
            )}
            <div style={{ marginTop: 14, fontSize: 11, color: '#475569', textAlign: 'center' }}>
              Powered by InstaSend · Secured M-Pesa STK Push
            </div>
          </div>
        )}

        {/* Token tab */}
        {tab === 'token' && (
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Enter your token code from the developer</label>
            <input
              value={token} onChange={e => setToken(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && submitToken()}
              placeholder="EDU-KYAI-20251231-0300-XXXX"
              style={{ width: '100%', padding: '12px 14px', marginBottom: 14, background: '#0f1117', border: '1px solid #2a3350', borderRadius: 10, color: '#7c3aed', fontSize: 14, fontFamily: 'monospace', boxSizing: 'border-box', letterSpacing: 1 }}
            />
            <button onClick={submitToken} disabled={!token.trim()} style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
              Activate Token
            </button>
            {tokMsg && (
              <div style={{ marginTop: 12, padding: 12, background: tokMsg.includes('✅') ? '#10b98115' : '#ef444415', borderRadius: 10, fontSize: 13, color: tokMsg.includes('✅') ? '#10b981' : '#ef4444', border: `1px solid ${tokMsg.includes('✅') ? '#10b98130' : '#ef444430'}` }}>
                {tokMsg}
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
              Contact the system developer (Felix) to get a token if you paid via bank or other method.
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 11, color: '#334155', lineHeight: 1.7, borderTop: '1px solid #1e2435', paddingTop: 16 }}>
          🔒 Read-Only mode is active. <strong style={{ color: '#64748b' }}>All your data is safe.</strong><br />
          Pay to resume full access for Term {license.currentTerm} {license.currentYear}.
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DEVELOPER TOKEN GENERATOR — inside Settings
   Password-protected so only you (Felix) can use it
═══════════════════════════════════════════════════════ */
export function TokenGenerator({ data }) {
  // ── SET YOUR DEVELOPER PASSWORD HERE ─────────────
  const DEV_PASSWORD = 'Felix@EduManage2025!';
  // ─────────────────────────────────────────────────

  const [expiry, setExpiry] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 90);
    return d.toISOString().split('T')[0];
  });
  const [seats, setSeats]         = useState(500);
  const [generated, setGenerated] = useState('');
  const [copied, setCopied]       = useState(false);
  const [devPass, setDevPass]     = useState('');
  const [authed, setAuthed]       = useState(false);
  const [passErr, setPassErr]     = useState('');
  const [targetSchool, setTargetSchool] = useState(data.schoolName || '');

  function checkPassword() {
    if (devPass === DEV_PASSWORD) { setAuthed(true); setPassErr(''); }
    else setPassErr('Wrong password. Try again.');
  }

  function generate() {
    if (!targetSchool.trim()) { alert('Enter the school name first.'); return; }
    const tok = makeToken(targetSchool.trim(), expiry, seats);
    setGenerated(tok);
  }

  function copy() {
    navigator.clipboard?.writeText(generated);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function copyWhatsApp() {
    const msg =
      `*EduManage Pro Access Token*\n\n` +
      `🏫 School: ${targetSchool}\n` +
      `🔑 Token: ${generated}\n` +
      `📅 Valid until: ${new Date(expiry).toLocaleDateString('en-KE')}\n` +
      `👥 Max students: ${seats}\n\n` +
      `*How to use:*\n` +
      `1. Open the system\n` +
      `2. Click "Use Token" tab\n` +
      `3. Paste the token above\n` +
      `4. Click "Activate Token"`;
    navigator.clipboard?.writeText(msg);
    alert('WhatsApp message copied! Paste in WhatsApp and send to school.');
  }

  const daysCount = Math.ceil((new Date(expiry) - new Date()) / 86400000);

  return (
    <div style={{ background: '#0a0d14', border: '1px solid #7c3aed40', borderRadius: 14, padding: 20, marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed', marginBottom: 14 }}>🔑 Developer: Generate Access Token</div>

      {!authed ? (
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Enter developer password to access token generator</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password" value={devPass}
              onChange={e => setDevPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && checkPassword()}
              placeholder="Developer password"
              style={{ flex: 1, padding: '8px 12px', background: '#171b26', border: '1px solid #2a3350', borderRadius: 8, color: '#e2e8f0', fontSize: 13 }}
            />
            <button onClick={checkPassword} style={{ padding: '8px 16px', background: '#7c3aed', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Unlock</button>
          </div>
          {passErr && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{passErr}</div>}
        </div>
      ) : (
        <div>
          {/* School name field */}
          <div style={{ marginBottom: 12, padding: '10px 12px', background: '#171b26', border: '1px solid #7c3aed40', borderRadius: 8 }}>
            <label style={{ fontSize: 11, color: '#7c3aed', display: 'block', marginBottom: 6, fontWeight: 700 }}>
              🏫 Generating token for school:
            </label>
            <input
              value={targetSchool}
              onChange={e => { setTargetSchool(e.target.value); setGenerated(''); }}
              placeholder="Enter exact school name as registered"
              style={{ width: '100%', padding: '8px 10px', background: '#0f1117', border: '1px solid #2a3350', borderRadius: 6, color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
            />
            {targetSchool && <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Token ID: {schoolHash(targetSchool.trim())} — unique to this school name</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Expiry Date ({daysCount} days)</label>
              <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} min={new Date().toISOString().split('T')[0]}
                style={{ width: '100%', padding: '8px 10px', background: '#171b26', border: '1px solid #2a3350', borderRadius: 8, color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Max Students</label>
              <input type="number" value={seats} onChange={e => setSeats(Number(e.target.value))} min={1} max={9999}
                style={{ width: '100%', padding: '8px 10px', background: '#171b26', border: '1px solid #2a3350', borderRadius: 8, color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Quick presets */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[{ label: '14 days', days: 14 }, { label: '30 days', days: 30 }, { label: '1 Term (90d)', days: 90 }, { label: '1 Year', days: 365 }].map(({ label, days }) => {
              const d = new Date(); d.setDate(d.getDate() + days);
              return (
                <button key={label} onClick={() => setExpiry(d.toISOString().split('T')[0])}
                  style={{ padding: '4px 10px', background: '#171b26', border: '1px solid #2a3350', borderRadius: 6, color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>
                  {label}
                </button>
              );
            })}
          </div>

          <button onClick={generate} style={{ width: '100%', padding: '10px 0', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            Generate Token for {targetSchool || 'School'}
          </button>

          {generated && (
            <div style={{ background: '#171b26', border: '1px solid #7c3aed40', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Send this token to the school via WhatsApp or SMS:</div>
              <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#7c3aed', wordBreak: 'break-all', marginBottom: 12, letterSpacing: 1, background: '#0f1117', padding: '10px 12px', borderRadius: 8 }}>
                {generated}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button onClick={copy} style={{ flex: 1, padding: '8px 0', background: copied ? '#10b981' : '#4f8ef7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {copied ? '✅ Copied!' : '📋 Copy Token'}
                </button>
                <button onClick={copyWhatsApp} style={{ flex: 1, padding: '8px 0', background: '#25d366', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  📲 Copy WhatsApp Msg
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>
                ✅ Valid until: <strong style={{ color: '#e2e8f0' }}>{new Date(expiry).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</strong><br />
                👥 Max students: <strong style={{ color: '#e2e8f0' }}>{seats}</strong><br />
                🏫 School code: <strong style={{ color: '#7c3aed' }}>{(data.schoolName || 'SCHOOL').toUpperCase().slice(0, 4).padEnd(4, 'X')}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
