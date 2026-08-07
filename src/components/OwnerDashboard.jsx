import React, { useState, useEffect } from 'react';
import {
  listAllSchemes, uploadSchemeFile, createSchemeRecord,
  deleteScheme, setSchemeActive,
} from '../supabase';

const TOKEN_URL = '/.netlify/functions/generate-token';

/* ═══════════════════════════════════════════════════════════════════
   OWNER DASHBOARD — reachable at ?action=owner
   ─────────────────────────────────────────────────────────────────
   Gated by the SAME DEVELOPER_SECRET password already used for the
   license token generator (server-verified, never shipped in the
   frontend bundle). Nobody with a principal/teacher/student/parent
   login can reach this — it's a completely separate password and a
   completely separate URL.
═══════════════════════════════════════════════════════════════════ */
export default function OwnerDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [authErr, setAuthErr]   = useState('');

  async function tryUnlock() {
    if (!password.trim()) return;
    setChecking(true);
    setAuthErr('');
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', password }),
      });
      const json = await res.json();
      if (json.ok) setUnlocked(true);
      else setAuthErr('Wrong password.');
    } catch {
      setAuthErr('Network error — try again.');
    }
    setChecking(false);
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ background: '#1e293b', borderRadius: 14, padding: 32, width: 340, color: '#fff' }}>
          <h2 style={{ marginTop: 0 }}>🔒 Owner Access</h2>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>Schemes of Work management — owner only.</p>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
            placeholder="Password" autoFocus
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#fff', marginBottom: 10, boxSizing: 'border-box' }}
          />
          {authErr && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{authErr}</div>}
          <button onClick={tryUnlock} disabled={checking}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: '#4f8ef7', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            {checking ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </div>
    );
  }

  return <SchemesManager />;
}

function SchemesManager() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  function refresh() {
    setLoading(true);
    listAllSchemes().then(setSchemes).catch(e => alert(e.message)).finally(() => setLoading(false));
  }
  useEffect(refresh, []);

  async function handleDelete(s) {
    if (!window.confirm(`Permanently delete "${s.subject} — ${s.class_name}"? This removes the file and cannot be undone.`)) return;
    try {
      await deleteScheme(s.id, s.storage_path);
      refresh();
    } catch (e) { alert(e.message); }
  }

  async function handleToggleActive(s) {
    try {
      await setSchemeActive(s.id, !s.active);
      refresh();
    } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>📘 Schemes of Work — Owner Dashboard</h1>
          <button onClick={() => setShowUpload(true)}
            style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}>
            + Upload Scheme
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>
        ) : schemes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No schemes uploaded yet.</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={th}>Subject</th>
                  <th style={th}>Class</th>
                  <th style={th}>Term</th>
                  <th style={th}>System Price</th>
                  <th style={th}>Public Price</th>
                  <th style={th}>Status</th>
                  <th style={th}>Uploaded</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {schemes.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid #e2e8f0', opacity: s.active ? 1 : 0.5 }}>
                    <td style={td}>{s.subject}</td>
                    <td style={td}>{s.class_name}</td>
                    <td style={td}>{s.term}</td>
                    <td style={td}>KES {s.price_system}</td>
                    <td style={td}>KES {s.price_public}</td>
                    <td style={td}>{s.active ? '✅ Active' : '⏸ Hidden'}</td>
                    <td style={td}>{new Date(s.uploaded_at).toLocaleDateString('en-KE')}</td>
                    <td style={{ ...td, display: 'flex', gap: 6 }}>
                      <button onClick={() => handleToggleActive(s)} style={btnGhostSm}>{s.active ? 'Hide' : 'Show'}</button>
                      <button onClick={() => handleDelete(s)} style={btnDangerSm}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); refresh(); }} />}
    </div>
  );
}

function UploadModal({ onClose, onDone }) {
  const [subject, setSubject]       = useState('');
  const [className, setClassName]   = useState('');
  const [term, setTerm]             = useState('');
  const [curriculum, setCurriculum] = useState('CBC');
  const [priceSystem, setPriceSystem] = useState(40);
  const [pricePublic, setPricePublic] = useState(70);
  const [file, setFile]             = useState(null);
  const [busy, setBusy]             = useState(false);

  async function submit() {
    if (!subject.trim() || !className.trim() || !term.trim() || !file) {
      alert('Subject, Class, Term, and a PDF file are all required.');
      return;
    }
    if (file.type !== 'application/pdf') { alert('Please choose a PDF file.'); return; }
    setBusy(true);
    try {
      const path = await uploadSchemeFile(file, subject, className);
      await createSchemeRecord({
        subject: subject.trim(), className: className.trim(), term: term.trim(),
        curriculum, storagePath: path,
        priceSystem: Number(priceSystem), pricePublic: Number(pricePublic),
      });
      onDone();
    } catch (e) {
      alert('Upload failed: ' + e.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000060', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
        <h3 style={{ marginTop: 0 }}>Upload a Scheme of Work</h3>
        <Field label="Subject"><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics" style={inputStyle} /></Field>
        <Field label="Class"><input value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. Grade 7" style={inputStyle} /></Field>
        <Field label="Term"><input value={term} onChange={e => setTerm(e.target.value)} placeholder="e.g. Term 2 2026" style={inputStyle} /></Field>
        <Field label="Curriculum">
          <select value={curriculum} onChange={e => setCurriculum(e.target.value)} style={inputStyle}>
            <option value="CBC">CBC</option>
            <option value="8-4-4">8-4-4</option>
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="System Price (KES)"><input type="number" value={priceSystem} onChange={e => setPriceSystem(e.target.value)} style={inputStyle} /></Field>
          <Field label="Public Price (KES)"><input type="number" value={pricePublic} onChange={e => setPricePublic(e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="PDF File"><input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} style={inputStyle} /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={busy} style={btnGhostSm}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ ...btnDangerSm, background: '#4f8ef7' }}>{busy ? 'Uploading…' : 'Upload'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10, flex: 1 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const th = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' };
const td = { padding: '10px 14px' };
const inputStyle = { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0', boxSizing: 'border-box' };
const btnGhostSm = { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 };
const btnDangerSm = { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 };
