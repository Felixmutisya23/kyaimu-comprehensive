import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  listActiveSchemes, getSchemePreviewUrl, getSchemeDownloadUrl,
  getSchemeAccessFor, recordSchemePurchase,
} from '../supabase';
import { personalizeScheme } from '../utils/personalizeScheme';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const VERIFY_PAYMENT_URL = '/.netlify/functions/verify-payment';

// Orders schemes properly: Subject (A–Z), then Grade number (1, 2, 3…
// not alphabetically, which would put "Grade 10" before "Grade 2"),
// then Year, then Term number. Plain alphabetical sorting on the raw
// text fields (the old behavior) scattered grades within each subject
// in whatever order they were uploaded/inserted, since "Term 3 2026"
// as a string doesn't sort numerically and class names aren't numeric
// text either.
function parseGradeNum(className) {
  const m = String(className || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999; // unparseable class names sort last, not lost
}
function parseTermYear(term) {
  const m = String(term || '').match(/(\d+)\D+(\d{4})/);
  return { termNum: m ? parseInt(m[1], 10) : 99, year: m ? parseInt(m[2], 10) : 9999 };
}
function sortSchemes(list) {
  return [...list].sort((a, b) => {
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    const gDiff = parseGradeNum(a.class_name) - parseGradeNum(b.class_name);
    if (gDiff !== 0) return gDiff;
    const ta = parseTermYear(a.term), tb = parseTermYear(b.term);
    if (ta.year !== tb.year) return ta.year - tb.year;
    return ta.termNum - tb.termNum;
  });
}

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
  defaultPhone = '',
  defaultName = '',
  defaultSchool = '',
  termlyBundle = null,        // portal mode: { schoolId, teacherId, subjects: [...] }
}) {
  const [schemes, setSchemes]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [phone, setPhone]       = useState(defaultPhone);
  const [name, setName]         = useState(defaultName);
  const [tscNumber, setTscNumber] = useState('');
  const [school, setSchool]     = useState(defaultSchool);
  const [access, setAccess]     = useState({ unlockedSchemeIds: new Set(), hasTermlyBundleFor: () => false });
  const [checkingAccess, setCheckingAccess] = useState(false);

  // Drill-down browse filters, as requested: pick a Year, then a Class,
  // then a Term, and see everything available for that combination —
  // instead of the system silently guessing which subjects to show
  // (which broke whenever a subject name didn't match exactly, e.g. a
  // teacher's assignment says "Kiswahili" but the catalog has "KIS").
  // '' means "any" for that filter level.
  const [fYear, setFYear]   = useState('');
  const [fClass, setFClass] = useState('');
  const [fTerm, setFTerm]   = useState('');

  const [previewScheme, setPreviewScheme] = useState(null);
  const [payTarget, setPayTarget]         = useState(null); // scheme object, or 'TERMLY' marker
  const [paying, setPaying]               = useState(false);

  useEffect(() => {
    listActiveSchemes()
      .then(all => setSchemes(sortSchemes(all)))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Distinct, sensibly-ordered option lists built from what's actually
  // in the catalog — so the dropdowns never offer an option with zero
  // results.
  const years = [...new Set(schemes.map(s => parseTermYear(s.term).year))].sort((a, b) => a - b);
  const classes = [...new Set(schemes.map(s => s.class_name))].sort((a, b) => parseGradeNum(a) - parseGradeNum(b));
  const termNums = [...new Set(schemes.map(s => parseTermYear(s.term).termNum))].sort((a, b) => a - b);

  const visibleSchemes = schemes.filter(s => {
    const ty = parseTermYear(s.term);
    if (fYear && String(ty.year) !== String(fYear)) return false;
    if (fClass && s.class_name !== fClass) return false;
    if (fTerm && String(ty.termNum) !== String(fTerm)) return false;
    return true;
  });

  async function checkAccess(p) {
    if (!p || p.replace(/\D/g, '').length < 9) return;
    setCheckingAccess(true);
    try {
      const a = await getSchemeAccessFor(p);
      setAccess(a);
    } catch (e) { console.error(e); }
    setCheckingAccess(false);
  }

  // Auto-check as soon as a complete-looking number is present — covers
  // both the pre-filled case (teacher portal passes defaultPhone) and
  // someone typing their number without ever clicking away from the
  // field. Previously this only ran on blur, so a returning buyer could
  // easily see everything as "locked" and think they had to pay again,
  // purely because the check never fired.
  useEffect(() => {
    const t = setTimeout(() => { if (phone) checkAccess(phone); }, 500);
    return () => clearTimeout(t);
  }, [phone]);

  const price = s => mode === 'portal' ? Number(s.price_system) : Number(s.price_public);
  // Was hardcoded to `40 * subjects.length` — silently wrong the moment
  // prices change (e.g. after a bulk price update in Owner Dashboard).
  // Now sums the live price_system of each subject actually in the bundle.
  const termlyPrice = termlyBundle
    ? termlyBundle.subjects.reduce((sum, subj) => {
        const match = schemes.find(s => s.subject === subj);
        return sum + (match ? Number(match.price_system) : 0);
      }, 0)
    : 0;
  const hasTermlyAccess = termlyBundle
    ? access.hasTermlyBundleFor(termlyBundle.schoolId, termlyBundle.teacherId)
    : false;

  function isUnlocked(scheme) {
    return access.unlockedSchemeIds.has(scheme.id) || (termlyBundle && hasTermlyAccess);
  }

  const [downloadingId, setDownloadingId] = useState(null);

  async function download(scheme) {
    if (!name.trim() || !tscNumber.trim() || !school.trim()) {
      alert('Please fill in your Name, TSC Number, and School before downloading — they get printed on your copy of the scheme.');
      return;
    }
    setDownloadingId(scheme.id);
    try {
      const url = await getSchemeDownloadUrl(scheme.storage_path);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Could not fetch the file');
      const arrayBuffer = await res.arrayBuffer();

      const personalized = await personalizeScheme(arrayBuffer, scheme.storage_path, {
        name: name.trim(), tscNumber: tscNumber.trim(), school: school.trim(),
      });

      const isDocx = /\.docx$/i.test(scheme.storage_path);
      const mimeType = isDocx
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';
      const blob = new Blob([personalized], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const ext = isDocx ? 'docx' : 'pdf';
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${scheme.subject}_${scheme.class_name}_${scheme.term}`.replace(/\s+/g, '_') + `.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (e) {
      console.error(e);
      alert('Download failed: ' + e.message + '. Please try again.');
    }
    setDownloadingId(null);
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
        alert(`Payment initiation failed: ${json.error || json.message || json.detail || 'Unknown error'}`);
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
        // IntaSend's real state values are uppercase: PENDING, PROCESSING,
        // COMPLETE, FAILED, CANCELED, PARTIAL, RETRY. Only COMPLETE was
        // ever checked for — FAILED/CANCELED (e.g. the user cancels the
        // M-Pesa prompt instead of entering their PIN) looked exactly
        // like "still pending" and silently kept polling for the full
        // 3-minute timeout with no indication anything had gone wrong.
        const status = (json.state || '').toUpperCase();

        if (status === 'COMPLETE') {
          clearInterval(interval);
          await recordSchemePurchase({
            buyerPhone: phone, buyerName: name,
            buyerTsc: tscNumber, buyerSchool: school,
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
        } else if (status === 'FAILED' || status === 'CANCELED') {
          clearInterval(interval);
          setPaying(false);
          const reason = json.failedReason ? ` (${json.failedReason})` : '';
          alert(status === 'CANCELED'
            ? '❌ Payment was cancelled — nothing was charged. Tap "Pay Now" again if you\'d like to retry.'
            : `❌ Payment failed${reason}. Nothing was charged — check your M-Pesa balance/PIN and try again.`);
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
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Your Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }} />
            </div>
          )}
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>TSC Number</label>
            <input value={tscNumber} onChange={e => setTscNumber(e.target.value)}
              placeholder="TSC/2020/123456" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>School Name</label>
            <input value={school} onChange={e => setSchool(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }} />
          </div>
          {checkingAccess && <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>Checking previous purchases…</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 6 }}>
          Already paid before? Enter the same number to unlock your downloads again — free, no need to pay twice.
          Your Name, TSC Number and School are printed on the downloaded copy, so fill these in before downloading.
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

      {!loading && schemes.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: 4 }}>Year</label>
            <select value={fYear} onChange={e => setFYear(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }}>
              <option value="">All years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: 4 }}>Class</label>
            <select value={fClass} onChange={e => setFClass(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }}>
              <option value="">All classes</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: 4 }}>Term</label>
            <select value={fTerm} onChange={e => setFTerm(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)' }}>
              <option value="">All terms</option>
              {termNums.map(t => <option key={t} value={t}>Term {t}</option>)}
            </select>
          </div>
          {(fYear || fClass || fTerm) && (
            <button onClick={() => { setFYear(''); setFClass(''); setFTerm(''); }}
              style={{ ...btnGhost, alignSelf: 'flex-end' }}>Clear filters</button>
          )}
        </div>
      )}

      {!loading && visibleSchemes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted, #64748b)' }}>
          {schemes.length === 0 ? 'No schemes of work available yet — check back soon.' : 'Nothing matches these filters — try a different Year, Class, or Term.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {visibleSchemes.map(s => {
          const unlocked = isUnlocked(s);
          return (
            <div key={s.id} style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: 14, background: 'var(--surface, #fff)' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.subject}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)' }}>{s.class_name} · {s.term}</div>
              {s.page_count && <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>{s.page_count} pages</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => setPreviewScheme(s)} style={btnGhost}>Preview</button>
                {unlocked ? (
                  <button onClick={() => download(s)} disabled={downloadingId === s.id} style={btnSuccess}>
                    {downloadingId === s.id ? 'Preparing…' : 'Download'}
                  </button>
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
  const [err, setErr]         = useState('');
  const [isPdf, setIsPdf]     = useState(true);
  const canvas1 = useRef(null);
  const canvas2 = useRef(null);

  useEffect(() => {
    let cancelled = false;
    // Word documents (.doc/.docx) can't be rendered page-by-page in the
    // browser the way PDFs can — show a clear "no preview" message
    // instead of letting pdf.js fail trying to parse a non-PDF file.
    const isWordDoc = /\.(docx?|DOCX?)$/i.test(scheme.storage_path);
    if (isWordDoc) { setIsPdf(false); return; }

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
        {!isPdf ? (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted, #64748b)' }}>
            📄 This is a Word document — a page preview isn't available, but the full document is exactly as described. Unlock to download.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', margin: '16px 0' }}>
            <canvas ref={canvas1} style={{ maxWidth: '100%', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 2px 8px #0001' }} />
            <canvas ref={canvas2} style={{ maxWidth: '100%', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 2px 8px #0001' }} />
          </div>
        )}
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
