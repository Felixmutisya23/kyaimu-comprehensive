import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  listActiveSchemes, getSchemePreviewUrl, getSchemeDownloadUrl,
  getSchemeAccessFor, recordSchemePurchase,
} from '../supabase';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const VERIFY_PAYMENT_URL = '/.netlify/functions/verify-payment';

/* ═══════════════════════════════════════════════════════════════════
   SCHEMES OF WORK MARKETPLACE
   ─────────────────────────────────────────────────────────────────
   Two modes:
   • "portal" — inside a logged-in teacher's own portal. Pre-filtered
     to their assigned subjects, priced at price_system (40/subject),
     with a termly bundle option (40 × their subject count, one payment
     unlocks all of them).
   • "public" — standalone page, no login. Browse everything, priced
     at price_public (70/subject), no bundle (buyer has no fixed
     "subjects taught" profile in the system).
═══════════════════════════════════════════════════════════════════ */
export default function SchemesMarketplace({
  mode = 'public',            // 'portal' | 'public'
  filterSubjects = null,      // portal mode: restrict to these subject names
  defaultPhone = '',
  defaultName = '',
  termlyBundle = null,        // portal mode: { schoolId, teacherId, subjects: [...] }
}) {
  const [schemes, setSchemes]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [phone, setPhone]       = useState(defaultPhone);
  const [name, setName]         = useState(defaultName);
  const [access, setAccess]     = useState({ unlockedSchemeIds: new Set(), hasTermlyBundleFor: () => false });
  const [checkingAccess, setCheckingAccess] = useState(false);

  const [previewScheme, setPreviewScheme] = useState(null);
  const [payTarget, setPayTarget]         = useState(null); // scheme object, or 'TERMLY' marker
  const [paying, setPaying]               = useState(false);

  useEffect(() => {
    listActiveSchemes()
      .then(all => {
        const filtered = filterSubjects
          ? all.filter(s => filterSubjects.includes(s.subject))
          : all;
        setSchemes(filtered);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterSubjects]);

  async function checkAccess(p) {
    if (!p || p.replace(/\D/g, '').length < 9) return;
    setCheckingAccess(true);
    try {
      const a = await getSchemeAccessFor(p);
      setAccess(a);
    } catch (e) { console.error(e); }
    setCheckingAccess(false);
  }

  const price = s => mode === 'portal' ? Number(s.price_system) : Number(s.price_public);
  const termlyPrice = termlyBundle ? 40 * termlyBundle.subjects.length : 0;
  const hasTermlyAccess = termlyBundle
    ? access.hasTermlyBundleFor(termlyBundle.schoolId, termlyBundle.teacherId)
    : false;

  function isUnlocked(scheme) {
    return access.unlockedSchemeIds.has(scheme.id) || (termlyBundle && hasTermlyAccess);
  }

  async function download(scheme) {
    try {
      const url = await getSchemeDownloadUrl(scheme.storage_path);
      window.open(url, '_blank');
    } catch (e) { alert('Download failed: ' + e.message); }
  }

  function normalizePhone(p) {
    let fp = p.replace(/\s/g, '').replace(/^0/, '254');
    if (!fp.startsWith('254')) fp = '254' + fp;
    return fp;
  }

  async function payFor(target) {
    if (!phone.trim()) { alert('Enter your M-Pesa phone number first.'); return; }
    setPaying(true);
    const isBundle = target === 'TERMLY';
    const amount = isBundle ? termlyPrice : price(target);
    const fp = normalizePhone(phone);

    try {
      const res = await fetch(VERIFY_PAYMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate',
          phone: fp,
          amount,
          apiRef: `SCHEME-${isBundle ? 'BUNDLE' : target.id}-${Date.now()}`,
          name: name || 'Teacher',
          email: 'noreply@school.ac.ke',
        }),
      });
      const json = await res.json();
      if (!json.invoice?.invoice_id) {
        alert(`Payment initiation failed: ${json.message || json.detail || 'Unknown error'}`);
        setPaying(false);
        return;
      }
      pollPayment(json.invoice.invoice_id, amount, isBundle, target);
    } catch {
      alert('Network error. Check your connection and try again.');
      setPaying(false);
    }
  }

  function pollPayment(invoiceId, amount, isBundle, target) {
    let attempts = 0;
    const maxAttempts = 36;
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
          await recordSchemePurchase({
            buyerPhone: phone, buyerName: name,
            schemeId: isBundle ? null : target.id,
            isTermlyBundle: isBundle,
            termlySchoolId: isBundle ? termlyBundle.schoolId : null,
            termlyTeacherId: isBundle ? termlyBundle.teacherId : null,
            termlySubjects: isBundle ? termlyBundle.subjects : null,
            amountPaid: amount, paymentRef: invoiceId,
          });
          await checkAccess(phone);
          setPaying(false);
          setPayTarget(null);
          alert(`✅ Payment confirmed! KES ${amount} received. You can now download.`);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPaying(false);
          alert('Payment not confirmed yet. If you completed the M-Pesa prompt, wait a moment and re-enter your phone number to check again.');
        }
      } catch (e) { console.error(e); }
    }, 5000);
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ background: 'var(--surface2, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Your M-Pesa Phone Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => checkAccess(phone)}
              placeholder="07XXXXXXXX" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }} />
          </div>
          {mode === 'public' && (
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Your Name (optional)</label>
              <input value={name} onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }} />
            </div>
          )}
          {checkingAccess && <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>Checking previous purchases…</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 6 }}>
          Already paid before? Enter the same number to unlock your downloads again — free, no need to pay twice.
        </div>
      </div>

      {termlyBundle && termlyBundle.subjects.length > 1 && (
        <div style={{ background: '#4f8ef710', border: '2px solid #4f8ef7', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>📦 Termly Pass — unlock all {termlyBundle.subjects.length} of your subjects</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{termlyBundle.subjects.join(', ')}</div>
          </div>
          {hasTermlyAccess ? (
            <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Unlocked</span>
          ) : (
            <button onClick={() => setPayTarget('TERMLY')} style={btnPrimary}>Unlock All — KES {termlyPrice}</button>
          )}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted, #64748b)' }}>Loading schemes of work…</div>}
      {err && <div style={{ color: '#ef4444', padding: 16 }}>{err}</div>}
      {!loading && schemes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted, #64748b)' }}>
          No schemes of work available {filterSubjects ? 'for your subjects' : ''} yet — check back soon.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {schemes.map(s => {
          const unlocked = isUnlocked(s);
          return (
            <div key={s.id} style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: 14, background: 'var(--surface, #fff)' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.subject}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)' }}>{s.class_name} · {s.term}</div>
              {s.page_count && <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>{s.page_count} pages</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => setPreviewScheme(s)} style={btnGhost}>Preview</button>
                {unlocked ? (
                  <button onClick={() => download(s)} style={btnSuccess}>Download</button>
                ) : (
                  <button onClick={() => setPayTarget(s)} style={btnPrimary}>Unlock — KES {price(s)}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {previewScheme && (
        <PreviewModal scheme={previewScheme} onClose={() => setPreviewScheme(null)}
          onUnlock={() => { setPayTarget(previewScheme); setPreviewScheme(null); }}
          unlocked={isUnlocked(previewScheme)}
          onDownload={() => download(previewScheme)} />
      )}

      {payTarget && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget && !paying) setPayTarget(null); }}>
          <div style={modalBoxStyle}>
            <h3 style={{ marginTop: 0 }}>
              {payTarget === 'TERMLY' ? 'Unlock all your subjects' : `Unlock ${payTarget.subject} — ${payTarget.class_name}`}
            </h3>
            <p style={{ color: 'var(--text-muted, #64748b)', fontSize: 14 }}>
              KES {payTarget === 'TERMLY' ? termlyPrice : price(payTarget)} via M-Pesa STK Push to <strong>{phone || '(enter phone above)'}</strong>
            </p>
            {paying ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div>⏳ Waiting for M-Pesa confirmation…</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 8 }}>Check your phone and enter your M-Pesa PIN.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setPayTarget(null)} style={btnGhost}>Cancel</button>
                <button onClick={() => payFor(payTarget)} style={btnPrimary}>Pay Now</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 2-page real PDF preview, rendered via pdf.js to canvas ────────── */
function PreviewModal({ scheme, onClose, onUnlock, unlocked, onDownload }) {
  const [urls, setUrls] = useState(null);
  const [err, setErr]   = useState('');
  const canvas1 = useRef(null);
  const canvas2 = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getSchemePreviewUrl(scheme.storage_path)
      .then(async url => {
        const doc = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;
        await renderPage(doc, 1, canvas1.current);
        if (doc.numPages > 1) await renderPage(doc, 2, canvas2.current);
      })
      .catch(e => setErr(e.message));
    return () => { cancelled = true; };
  }, [scheme]);

  async function renderPage(doc, num, canvasEl) {
    if (!canvasEl) return;
    const page = await doc.getPage(num);
    const viewport = page.getViewport({ scale: 1.2 });
    canvasEl.width = viewport.width;
    canvasEl.height = viewport.height;
    await page.render({ canvasContext: canvasEl.getContext('2d'), viewport }).promise;
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...modalBoxStyle, maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{scheme.subject} — {scheme.class_name} (Preview, page 1–2)</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {err && <div style={{ color: '#ef4444' }}>{err}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', margin: '16px 0' }}>
          <canvas ref={canvas1} style={{ maxWidth: '100%', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 2px 8px #0001' }} />
          <canvas ref={canvas2} style={{ maxWidth: '100%', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 2px 8px #0001' }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted, #64748b)', marginBottom: 12 }}>
          This is a 2-page preview — unlock to view and download the full document.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {unlocked ? (
            <button onClick={onDownload} style={btnSuccess}>Download Full PDF</button>
          ) : (
            <button onClick={onUnlock} style={btnPrimary}>Unlock Full Document</button>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: '#00000060', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalBoxStyle = { background: 'var(--bg, #fff)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 };
const btnPrimary = { background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 };
const btnSuccess = { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 };
const btnGhost   = { background: 'none', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' };
