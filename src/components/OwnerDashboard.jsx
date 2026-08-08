import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  listAllSchemes, uploadSchemeFile, createSchemeRecord,
  deleteScheme, setSchemeActive,
} from '../supabase';
import { CURRICULUM_LEVELS } from '../data/initialData';

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
  const [showBulkUpload, setShowBulkUpload] = useState(false);

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
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowBulkUpload(true)}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}>
              📦 Bulk Upload
            </button>
            <button onClick={() => setShowUpload(true)}
              style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}>
              + Upload Scheme
            </button>
          </div>
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
      {showBulkUpload && <BulkUploadModal onClose={() => setShowBulkUpload(false)} onDone={() => refresh()} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BULK UPLOAD — parses a batch of files named like
   "GRADE7_TERM3_2026_PRE-TECHNICAL_STUDIES.pdf" and pre-fills Class/
   Subject/Term for every file, so uploading a whole term's worth of
   schemes for one grade (or several) is one review + one click instead
   of filling the single-upload form over and over.

   Accepts: a .zip containing PDFs/DOCX, or multiple files picked
   directly. Subject matching is best-effort (fuzzy match against the
   curriculum's canonical subject list) — every row stays fully
   editable before you confirm, so a wrong guess is a two-second fix,
   not a re-upload.
═══════════════════════════════════════════════════════════════════ */
function normalizeStr(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function tokenize(s) {
  return (String(s || '').toLowerCase().match(/[a-z0-9]+/g)) || [];
}

function guessLevelKeyForGrade(gradeNum) {
  if (gradeNum >= 1 && gradeNum <= 3) return 'LOWER_PRIMARY';
  if (gradeNum >= 4 && gradeNum <= 6) return 'UPPER_PRIMARY';
  if (gradeNum >= 7 && gradeNum <= 9) return 'JUNIOR_SECONDARY';
  // Grades 10–12 (CBC Senior Secondary) were missing entirely here —
  // any Grade 10+ file silently fell through to the LOWER_PRIMARY
  // default below, whose class list only goes up to Grade 3. That's
  // exactly why uploading a Grade 10 file failed: "Grade 10" simply
  // didn't exist in the dropdown it was being matched against.
  if (gradeNum >= 10 && gradeNum <= 12) return 'SENIOR_SECONDARY';
  return 'LOWER_PRIMARY';
}

// Best-effort match of a raw parsed subject name against the level's
// canonical subject list. Returns the canonical name if reasonably
// confident, or null if nothing looks close enough (caller falls back
// to "Other" with the raw parsed text pre-filled for manual review).
//
// IMPORTANT: matches on whole WORDS, not raw substrings. An earlier
// version checked "does canonical appear inside raw" as plain text,
// which wrongly matched "CRE" against "CREATIVE ARTS AND SPORTS" —
// "cre" is a substring of "CREative" even though they're unrelated
// subjects. Tokenizing both sides and requiring every canonical word
// to appear as a COMPLETE word in the raw filename avoids that.
function guessCanonicalSubject(rawSubject, levelKey) {
  const canonical = CURRICULUM_LEVELS[levelKey]?.subjects || [];
  const rawNorm = normalizeStr(rawSubject);
  if (!rawNorm) return null;
  const exact = canonical.find(c => normalizeStr(c) === rawNorm);
  if (exact) return exact;
  const rawTokens = tokenize(rawSubject);
  const partial = canonical.find(c => {
    const cTokens = tokenize(c);
    return cTokens.length > 0 && cTokens.every(t => rawTokens.includes(t));
  });
  return partial || null;
}

// Parses "GRADE7_TERM3_2026_PRE-TECHNICAL_STUDIES.pdf" into its parts.
// Returns null if the filename doesn't match the expected pattern —
// those files still get added as a row, just with everything blank
// for manual entry rather than being silently dropped.
function parseSchemeFilename(fileName) {
  const m = fileName.match(/^GRADE\s*(\d+)[_\s]+TERM\s*(\d+)[_\s]+(\d{4})[_\s]+(.+?)\.(pdf|docx?|PDF|DOCX?)$/i);
  if (!m) return null;
  const [, gradeNum, termNum, year, subjectRaw] = m;
  const grade = parseInt(gradeNum, 10);
  const levelKey = guessLevelKeyForGrade(grade);
  const cleanedSubject = subjectRaw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
  return {
    className: `Grade ${grade}`,
    term: `Term ${termNum} ${year}`,
    levelKey,
    subjectGuess: guessCanonicalSubject(cleanedSubject, levelKey),
    subjectRawCleaned: cleanedSubject,
  };
}

const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
function isAcceptedFile(fileName) {
  return /\.(pdf|docx?|PDF|DOCX?)$/i.test(fileName);
}

let rowIdCounter = 0;

function BulkUploadModal({ onClose, onDone }) {
  const OTHER = '__other__';
  const [rows, setRows]     = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [doneCount, setDoneCount]   = useState(0);
  const [defaultPriceSystem, setDefaultPriceSystem] = useState(40);
  const [defaultPricePublic, setDefaultPricePublic] = useState(70);

  async function handleFiles(fileList) {
    setExtracting(true);
    const picked = Array.from(fileList);
    const newRows = [];

    for (const f of picked) {
      if (/\.zip$/i.test(f.name)) {
        try {
          const zip = await JSZip.loadAsync(f);
          for (const [path, entry] of Object.entries(zip.files)) {
            if (entry.dir || !isAcceptedFile(path)) continue;
            const blob = await entry.async('blob');
            const fileName = path.split('/').pop();
            const asFile = new File([blob], fileName, { type: blob.type || 'application/pdf' });
            newRows.push(buildRow(asFile, fileName));
          }
        } catch (e) {
          alert(`Couldn't read "${f.name}" as a zip: ${e.message}`);
        }
      } else if (isAcceptedFile(f.name)) {
        newRows.push(buildRow(f, f.name));
      }
    }
    setRows(r => [...r, ...newRows]);
    setExtracting(false);
  }

  function buildRow(file, fileName) {
    const parsed = parseSchemeFilename(fileName);
    return {
      id: ++rowIdCounter,
      file, fileName,
      levelKey: parsed?.levelKey || 'LOWER_PRIMARY',
      className: parsed?.className || '',
      classOther: '',
      subject: parsed?.subjectGuess || (parsed ? OTHER : ''),
      subjectOther: parsed && !parsed.subjectGuess ? parsed.subjectRawCleaned : '',
      term: parsed?.term || '',
      priceSystem: defaultPriceSystem,
      pricePublic: defaultPricePublic,
      status: 'pending', // pending | uploading | done | error
      error: '',
      matched: !!parsed,
    };
  }

  function updateRow(id, patch) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }
  function removeRow(id) {
    setRows(rs => rs.filter(r => r.id !== id));
  }
  function applyDefaultPricesToAll() {
    setRows(rs => rs.map(r => ({ ...r, priceSystem: defaultPriceSystem, pricePublic: defaultPricePublic })));
  }

  async function uploadAll() {
    const invalid = rows.filter(r => {
      const cls = r.className === OTHER ? r.classOther.trim() : r.className;
      const subj = r.subject === OTHER ? r.subjectOther.trim() : r.subject;
      return !cls || !subj || !r.term.trim();
    });
    if (invalid.length > 0) {
      alert(`${invalid.length} row(s) are missing Class, Subject, or Term — fix the highlighted rows before uploading.`);
      return;
    }
    setUploading(true);
    setDoneCount(0);
    for (const row of rows) {
      if (row.status === 'done') continue;
      updateRow(row.id, { status: 'uploading' });
      const finalClass   = row.className === OTHER ? row.classOther.trim() : row.className;
      const finalSubject = row.subject === OTHER ? row.subjectOther.trim() : row.subject;
      try {
        const path = await uploadSchemeFile(row.file, finalSubject, finalClass);
        await createSchemeRecord({
          subject: finalSubject, className: finalClass, term: row.term.trim(),
          curriculum: 'CBC', storagePath: path,
          priceSystem: Number(row.priceSystem), pricePublic: Number(row.pricePublic),
        });
        updateRow(row.id, { status: 'done' });
        setDoneCount(c => c + 1);
      } catch (e) {
        updateRow(row.id, { status: 'error', error: e.message });
      }
    }
    setUploading(false);
    onDone();
  }

  const allDone = rows.length > 0 && rows.every(r => r.status === 'done');

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000060', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 920, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📦 Bulk Upload Schemes of Work</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {rows.length === 0 && (
          <>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Drop in a <strong>.zip</strong> of scheme files, or select multiple PDF/Word files directly. Files named like{' '}
              <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>GRADE7_TERM3_2026_MATHEMATICS.pdf</code>{' '}
              get Class, Subject, and Term auto-filled — you'll still get to review and fix every row before anything uploads.
            </p>
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: 30, textAlign: 'center', marginTop: 10 }}>
              <input type="file" multiple accept=".pdf,.docx,.doc,.zip"
                onChange={e => handleFiles(e.target.files)} disabled={extracting} />
              {extracting && <div style={{ marginTop: 10, color: '#64748b' }}>Reading files…</div>}
            </div>
          </>
        )}

        {rows.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', margin: '14px 0', flexWrap: 'wrap' }}>
              <Field label="Default System Price"><input type="number" value={defaultPriceSystem} onChange={e => setDefaultPriceSystem(Number(e.target.value))} style={inputStyle} /></Field>
              <Field label="Default Public Price"><input type="number" value={defaultPricePublic} onChange={e => setDefaultPricePublic(Number(e.target.value))} style={inputStyle} /></Field>
              <button onClick={applyDefaultPricesToAll} style={btnGhostSm}>Apply to all rows</button>
              <label style={{ ...btnGhostSm, marginLeft: 'auto', display: 'inline-block', cursor: 'pointer' }}>
                + Add more files
                <input type="file" multiple accept=".pdf,.docx,.doc,.zip" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
              </label>
            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              {rows.length} file(s) — {rows.filter(r => r.matched).length} auto-filled from filename, {rows.filter(r => !r.matched).length} need manual entry.
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                    <th style={th}>File</th>
                    <th style={th}>Class</th>
                    <th style={th}>Subject</th>
                    <th style={th}>Term</th>
                    <th style={th}>Sys ¥</th>
                    <th style={th}>Pub ¥</th>
                    <th style={th}>Status</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const level = CURRICULUM_LEVELS[row.levelKey];
                    const missing = (row.className === OTHER ? !row.classOther.trim() : !row.className) ||
                                     (row.subject === OTHER ? !row.subjectOther.trim() : !row.subject) ||
                                     !row.term.trim();
                    return (
                      <tr key={row.id} style={{ borderTop: '1px solid #e2e8f0', background: missing ? '#fef2f2' : 'transparent' }}>
                        <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.fileName}>{row.fileName}</td>
                        <td style={td}>
                          <select value={row.levelKey} onChange={e => updateRow(row.id, { levelKey: e.target.value, className: '', subject: '' })} style={{ ...inputStyle, marginBottom: 4, fontSize: 11 }}>
                            {Object.entries(CURRICULUM_LEVELS).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}
                          </select>
                          <select value={row.className} onChange={e => updateRow(row.id, { className: e.target.value })} style={inputStyle}>
                            <option value="">Select…</option>
                            {level.classes.map(c => <option key={c} value={c}>{c}</option>)}
                            <option value={OTHER}>Other…</option>
                          </select>
                          {row.className === OTHER && (
                            <input value={row.classOther} onChange={e => updateRow(row.id, { classOther: e.target.value })} placeholder="Type class" style={{ ...inputStyle, marginTop: 4 }} />
                          )}
                        </td>
                        <td style={td}>
                          <select value={row.subject} onChange={e => updateRow(row.id, { subject: e.target.value })} style={inputStyle}>
                            <option value="">Select…</option>
                            {level.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                            <option value={OTHER}>Other…</option>
                          </select>
                          {row.subject === OTHER && (
                            <input value={row.subjectOther} onChange={e => updateRow(row.id, { subjectOther: e.target.value })} placeholder="Type subject" style={{ ...inputStyle, marginTop: 4 }} />
                          )}
                        </td>
                        <td style={td}><input value={row.term} onChange={e => updateRow(row.id, { term: e.target.value })} style={{ ...inputStyle, minWidth: 90 }} /></td>
                        <td style={td}><input type="number" value={row.priceSystem} onChange={e => updateRow(row.id, { priceSystem: e.target.value })} style={{ ...inputStyle, width: 60 }} /></td>
                        <td style={td}><input type="number" value={row.pricePublic} onChange={e => updateRow(row.id, { pricePublic: e.target.value })} style={{ ...inputStyle, width: 60 }} /></td>
                        <td style={td}>
                          {row.status === 'pending' && <span style={{ color: '#94a3b8' }}>—</span>}
                          {row.status === 'uploading' && <span style={{ color: '#4f8ef7' }}>⏳</span>}
                          {row.status === 'done' && <span style={{ color: '#16a34a' }}>✓</span>}
                          {row.status === 'error' && <span style={{ color: '#ef4444' }} title={row.error}>✕</span>}
                        </td>
                        <td style={td}>
                          {row.status === 'pending' && <button onClick={() => removeRow(row.id)} style={{ ...btnGhostSm, color: '#ef4444' }}>✕</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {uploading && `Uploading… ${doneCount}/${rows.length}`}
                {allDone && `✅ All ${rows.length} uploaded.`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={btnGhostSm}>{allDone ? 'Close' : 'Cancel'}</button>
                {!allDone && (
                  <button onClick={uploadAll} disabled={uploading} style={{ ...btnDangerSm, background: '#16a34a' }}>
                    {uploading ? 'Uploading…' : `Upload All (${rows.length})`}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UploadModal({ onClose, onDone }) {
  const OTHER = '__other__';
  const [levelKey, setLevelKey]     = useState('LOWER_PRIMARY');
  const [subject, setSubject]       = useState('');
  const [subjectOther, setSubjectOther] = useState('');
  const [className, setClassName]   = useState('');
  const [classOther, setClassOther] = useState('');
  const [term, setTerm]             = useState('');
  const [curriculum, setCurriculum] = useState('CBC');
  const [priceSystem, setPriceSystem] = useState(40);
  const [pricePublic, setPricePublic] = useState(70);
  const [file, setFile]             = useState(null);
  const [busy, setBusy]             = useState(false);

  const level = CURRICULUM_LEVELS[levelKey];
  const finalSubject = subject === OTHER ? subjectOther.trim() : subject;
  const finalClass   = className === OTHER ? classOther.trim() : className;

  // Reset subject/class whenever the level changes, since the previous
  // selections belonged to a different level's list and won't be valid.
  function changeLevel(key) {
    setLevelKey(key);
    setSubject('');
    setClassName('');
  }

  async function submit() {
    if (!finalSubject || !finalClass || !term.trim() || !file) {
      alert('Subject, Class, Term, and a PDF file are all required.');
      return;
    }
    if (!isAcceptedFile(file.name)) { alert('Please choose a PDF or Word document.'); return; }
    setBusy(true);
    try {
      const path = await uploadSchemeFile(file, finalSubject, finalClass);
      await createSchemeRecord({
        subject: finalSubject, className: finalClass, term: term.trim(),
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
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Upload a Scheme of Work</h3>

        <Field label="Curriculum Level">
          <select value={levelKey} onChange={e => changeLevel(e.target.value)} style={inputStyle}>
            {Object.entries(CURRICULUM_LEVELS).map(([key, lvl]) => (
              <option key={key} value={key}>{lvl.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Class">
          <select value={className} onChange={e => setClassName(e.target.value)} style={inputStyle}>
            <option value="">Select a class…</option>
            {level.classes.map(c => <option key={c} value={c}>{c}</option>)}
            <option value={OTHER}>Other (type manually)…</option>
          </select>
          {className === OTHER && (
            <input value={classOther} onChange={e => setClassOther(e.target.value)}
              placeholder="Type the class name" style={{ ...inputStyle, marginTop: 6 }} />
          )}
        </Field>

        <Field label="Subject">
          <select value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle}>
            <option value="">Select a subject…</option>
            {level.subjects.map(s => <option key={s} value={s}>{s}</option>)}
            <option value={OTHER}>Other (type manually)…</option>
          </select>
          {subject === OTHER && (
            <input value={subjectOther} onChange={e => setSubjectOther(e.target.value)}
              placeholder="Type the subject name" style={{ ...inputStyle, marginTop: 6 }} />
          )}
        </Field>

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
        <Field label="File (PDF or Word)"><input type="file" accept=".pdf,.docx,.doc" onChange={e => setFile(e.target.files[0])} style={inputStyle} /></Field>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: -4, marginBottom: 10 }}>Note: only PDF files get a 2-page preview for buyers — Word docs skip straight to "unlock to download".</div>
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
