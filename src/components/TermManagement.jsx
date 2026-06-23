import React, { useState } from 'react';
import { Card, Btn, FormGroup, FormRow, SectionTitle, Alert, Tag, Icon } from './UI';

/* ═══════════════════════════════════════════════════════
   TERM MANAGEMENT
   • Admin sets start date, end date for each term
   • System knows the current term automatically
   • Term info shows on dashboard, fees, reports etc.
   • When a term ends → subscription payment for next term required
═══════════════════════════════════════════════════════ */

const BLANK_TERM = (year, term) => ({
  id: `${year}-T${term}`,
  year: Number(year),
  term: Number(term),
  startDate: '',
  endDate: '',
  midtermReportingDate: '', // date students report back after midterm break
  nextTermOpeningDate:  '', // date next term opens (shown on report forms)
  name: `Term ${term} ${year}`,
  opened: false,
  closed: false,
});

export function getCurrentTermInfo(data) {
  const today = new Date().toISOString().split('T')[0];
  const terms = data.terms || [];

  // Find term where today is within range
  const active = terms.find(t =>
    t.startDate && t.endDate &&
    today >= t.startDate && today <= t.endDate
  );
  if (active) return { ...active, status: 'active' };

  // Find nearest upcoming
  const upcoming = terms
    .filter(t => t.startDate && t.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (upcoming) return { ...upcoming, status: 'upcoming' };

  // Find most recently ended
  const past = terms
    .filter(t => t.endDate && t.endDate < today)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  if (past) return { ...past, status: 'ended' };

  // Fallback: derive from date
  const m = new Date().getMonth();
  const y = new Date().getFullYear();
  const t = m < 4 ? 1 : m < 8 ? 2 : 3;
  return { year: y, term: t, name: `Term ${t} ${y}`, status: 'unknown' };
}

export function TermBadge({ data, style }) {
  const info = getCurrentTermInfo(data);
  const colors = { active: '#10b981', upcoming: '#4f8ef7', ended: '#f59e0b', unknown: 'var(--text-muted)' };
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: colors[info.status] + '20', color: colors[info.status],
      border: `1px solid ${colors[info.status]}30`, ...style,
    }}>
      {info.name} · {info.status === 'active' ? 'IN SESSION' : info.status === 'ended' ? 'ENDED' : info.status === 'upcoming' ? 'UPCOMING' : 'TERM'}
    </span>
  );
}

export default function TermManagement({ data, setData }) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const [selYear, setSelYear] = useState(currentYear);
  const [editing, setEditing] = useState(null); // term object being edited
  const [form, setForm] = useState({});

  function getTermsForYear(year) {
    const saved = (data.terms || []).filter(t => t.year === year);
    return [1, 2, 3].map(t => saved.find(s => s.term === t) || BLANK_TERM(year, t));
  }

  const terms = getTermsForYear(selYear);

  function startEdit(term) {
    setEditing(term);
    setForm({
      name:                 term.name,
      startDate:            term.startDate            || '',
      endDate:              term.endDate              || '',
      midtermReportingDate: term.midtermReportingDate || '',
      nextTermOpeningDate:  term.nextTermOpeningDate  || '',
    });
  }

  function save() {
    setData(d => {
      const existing = d.terms || [];
      const without  = existing.filter(t => t.id !== editing.id);
      const updated  = {
        ...editing, ...form,
        startDate:            form.startDate,
        endDate:              form.endDate,
        midtermReportingDate: form.midtermReportingDate || '',
        nextTermOpeningDate:  form.nextTermOpeningDate  || '',
      };
      return { ...d, terms: [...without, updated] };
    });
    setEditing(null);
  }

  function openTerm(term) {
    if (!term.startDate || !term.endDate) { alert('Please set start and end dates first.'); return; }
    setData(d => {
      const existing = d.terms || [];
      const without  = existing.filter(t => t.id !== term.id);
      return { ...d, terms: [...without, { ...term, opened: true, closed: false }],
        currentTerm: term.term, currentYear: term.year };
    });
    alert(`✅ Term ${term.term} ${term.year} opened! Fees and records are now active.`);
  }

  function closeTerm(term) {
    if (!window.confirm(`Close Term ${term.term} ${term.year}? This will mark the term as ended.`)) return;
    setData(d => {
      const existing = d.terms || [];
      const without  = existing.filter(t => t.id !== term.id);
      return { ...d, terms: [...without, { ...term, closed: true }] };
    });
    alert(`Term ${term.term} ${term.year} closed. Remember to collect fees for next term!`);
  }

  const today = new Date().toISOString().split('T')[0];

  function termStatus(term) {
    if (!term.startDate) return 'not-set';
    if (term.closed) return 'closed';
    if (term.opened && today >= term.startDate && today <= term.endDate) return 'active';
    if (today < term.startDate) return 'upcoming';
    if (today > term.endDate) return 'ended';
    return 'not-started';
  }

  const statusColors = {
    'active': '#10b981', 'upcoming': '#4f8ef7', 'ended': '#f59e0b',
    'closed': 'var(--text-muted)', 'not-set': '#ef4444', 'not-started': 'var(--text-sub)',
  };
  const statusLabels = {
    'active': 'IN SESSION', 'upcoming': 'UPCOMING', 'ended': 'ENDED',
    'closed': 'CLOSED', 'not-set': 'NOT SET', 'not-started': 'NOT STARTED',
  };

  return (
    <div>
      <SectionTitle>Term Calendar Management</SectionTitle>

      {/* Year selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {years.map(y => (
          <button key={y} onClick={() => setSelYear(y)} style={{
            padding: '6px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: selYear === y ? '#4f8ef7' : 'var(--surface2)', color: selYear === y ? '#fff' : 'var(--text-sub)', fontWeight: 600, fontSize: 13,
          }}>{y}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        {terms.map(term => {
          const st = termStatus(term);
          const col = statusColors[st];
          return (
            <Card key={term.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Term {term.term} · {term.year}</div>
                <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: col + '20', color: col, border: `1px solid ${col}30` }}>
                  {statusLabels[st]}
                </span>
              </div>

              {term.startDate ? (
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 12, lineHeight: 1.8 }}>
                  <div>📅 Start: <strong style={{ color: 'var(--text)' }}>{term.startDate}</strong></div>
                  <div>🏁 End: <strong style={{ color: 'var(--text)' }}>{term.endDate}</strong></div>
                  {term.startDate && term.endDate && (
                    <div>📆 Duration: <strong style={{ color: 'var(--text)' }}>
                      {Math.ceil((new Date(term.endDate) - new Date(term.startDate)) / 86400000)} days
                    </strong></div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>⚠ Dates not configured</div>
              )}

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn size="sm" variant="ghost" onClick={() => startEdit(term)}>✏ Edit Dates</Btn>
                {!term.opened && term.startDate && (
                  <Btn size="sm" onClick={() => openTerm(term)} style={{ background: '#10b981' }}>▶ Open Term</Btn>
                )}
                {term.opened && !term.closed && st !== 'active' && (
                  <Btn size="sm" variant="danger" onClick={() => closeTerm(term)}>⏹ Close Term</Btn>
                )}
                {st === 'active' && (
                  <Btn size="sm" variant="danger" onClick={() => closeTerm(term)}>⏹ End Term</Btn>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <Card style={{ maxWidth: 400, width: '90%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              Edit Term {editing.term} · {editing.year}
            </div>
            <FormGroup label="Term Name">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={`Term ${editing.term} ${editing.year}`}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
            </FormGroup>
            <FormRow>
              <FormGroup label="Start Date">
                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </FormGroup>
              <FormGroup label="End Date">
                <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Midterm — Reporting Date" hint="Date students report back after midterm break">
                <input type="date" value={form.midtermReportingDate} onChange={e => setForm({ ...form, midtermReportingDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </FormGroup>
              <FormGroup label="Next Term Opening Date" hint="Printed on end-of-term report forms">
                <input type="date" value={form.nextTermOpeningDate} onChange={e => setForm({ ...form, nextTermOpeningDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </FormGroup>
            </FormRow>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn onClick={save}>Save Dates</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function PromotionPanel({ data, setData }) {
  const [preview, setPreview]   = useState(null);
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);

  function buildNextClassMap() {
    const groups   = data.classGroups || [];
    const allNames = [];
    groups.forEach(g => {
      if (!g.streams || g.streams.length == 0) {
        allNames.push(g.name);
      } else {
        g.streams.forEach(s => allNames.push(`${g.name} ${s}`));
      }
    });
    const map = {};
    allNames.forEach((cls, i) => {
      map[cls] = i < allNames.length - 1 ? allNames[i + 1] : null;
    });
    return map;
  }

  function generatePreview() {
    const nextMap   = buildNextClassMap();
    const students  = data.students || [];
    const promotions = [];
    const unchanged  = [];
    students.forEach(s => {
      if (!s.status || s.status == 'active') {
        const next = nextMap[s.class];
        if (next) promotions.push({ student: s, from: s.class, to: next });
        else if (s.class) unchanged.push({ student: s, reason: 'Completed school (final class)' });
      }
    });
    setPreview({ promotions, unchanged });
    setDone(false);
  }

  function applyPromotion() {
    if (!preview) return;
    setRunning(true);
    const year = data.currentYear || new Date().getFullYear();
    const newHistory = [
      ...(data.promotionHistory || []),
      ...preview.promotions.map(p => ({
        studentId: p.student.id, studentName: p.student.name,
        fromClass: p.from, toClass: p.to, year, promotedAt: new Date().toISOString(),
      })),
    ];
    const updatedStudents = (data.students || []).map(s => {
      const promo = preview.promotions.find(p => p.student.id == s.id);
      return promo ? { ...s, class: promo.to } : s;
    });
    setData(d => ({ ...d, students: updatedStudents, promotionHistory: newHistory }));
    setRunning(false);
    setDone(true);
    setPreview(null);
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid #7c3aed30', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#7c3aed', marginBottom: 12 }}>🎓 Student Promotion</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 16, lineHeight: 1.6 }}>
          At the end of Term 3, promote all active students to their next class.
        </div>
        {done && <div style={{ background: '#10b98115', border: '1px solid #10b98130', borderRadius: 8, padding: 12, marginBottom: 16, color: '#10b981', fontSize: 13 }}>✅ Promotion complete! All students moved to their next class.</div>}
        {!preview && (
          <button onClick={generatePreview} style={{ padding: '10px 20px', background: '#7c3aed', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            Preview Promotion
          </button>
        )}
        {preview && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>✅ {preview.promotions.length} students will be promoted:</div>
            <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              {preview.promotions.map((p, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                  <span style={{ flex: 1 }}>{p.student.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{p.from} → </span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{p.to}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPreview(null)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-sub)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={applyPromotion} disabled={running} style={{ padding: '8px 20px', background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {running ? 'Promoting...' : `✅ Confirm & Promote ${preview.promotions.length} Students`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
