import React from 'react';
import { getGrade, GRADES_CBC } from '../data/initialData';

/* ── Icon ─────────────────────────────────────────────── */
const PATHS = {
  dashboard:   'M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z',
  students:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 2 2 2 4-4',
  teachers:    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  exams:       'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  fees:        'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  timetable:   'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  messages:    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  kitchen:     'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3',
  settings:    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bell:        'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  dept:        'M2 20h20M4 20V10l8-7 8 7v10M10 20v-5h4v5',
  report:      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  add:         'M12 5v14M5 12h14',
  edit:        'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
  trash:       'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  print:       'M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2-5h6M7 21h10a1 1 0 0 0 1-1v-6H6v6a1 1 0 0 0 1 1zM17 3H7a1 1 0 0 0-1 1v3h12V4a1 1 0 0 0-1-1z',
  chart:       'M18 20V10M12 20V4M6 20v-6',
  check:       'M20 6 9 17l-5-5',
  x:           'M18 6 6 18M6 6l12 12',
  eye:         'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  download:    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  alert:       'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0-3.42 0zM12 9v4M12 17h.01',
  back:        'M19 12H5M12 19l-7-7 7-7',
  money:       'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  user:        'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  logout:      'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

export function Icon({ name, size = 18 }) {
  const d = PATHS[name] || PATHS.dashboard;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

/* ── Modal ────────────────────────────────────────────── */
export function Modal({ show, onClose, title, children, wide }) {
  if (!show) return null;
  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...S.modal, maxWidth: wide ? 800 : 580 }}>
        <div style={S.modalHeader}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Button ───────────────────────────────────────────── */
export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, style: extra }) {
  const base = { ...S.btn, ...(size === 'sm' ? S.btnSm : {}), ...S.variants[variant], ...(disabled ? S.btnDisabled : {}), ...extra };
  return <button style={base} onClick={onClick} disabled={disabled}>{children}</button>;
}

/* ── GradeBadge ───────────────────────────────────────── */
export function GradeBadge({ score }) {
  const g = getGrade(score);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: g.color + '25', color: g.color, border: `1px solid ${g.color}40`, display: 'inline-block' }}>
      {g.label} ({g.points}pts)
    </span>
  );
}

/* ── ProgressBar ──────────────────────────────────────── */
export function ProgressBar({ pct, color }) {
  const c = color || (pct >= 100 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444');
  return (
    <div style={{ background: '#252d42', borderRadius: 20, height: 6, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', borderRadius: 20, width: `${Math.min(pct, 100)}%`, background: c, transition: 'width 0.3s' }} />
    </div>
  );
}

/* ── Tag ──────────────────────────────────────────────── */
export function Tag({ children, color = 'blue' }) {
  const colors = {
    blue:   { bg: '#4f8ef720', text: '#4f8ef7' },
    green:  { bg: '#10b98120', text: '#10b981' },
    amber:  { bg: '#f59e0b20', text: '#f59e0b' },
    red:    { bg: '#ef444420', text: '#ef4444' },
    purple: { bg: '#7c3aed20', text: '#7c3aed' },
    gray:   { bg: '#64748b20', text: '#94a3b8' },
  };
  const c = colors[color] || colors.blue;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text }}>
      {children}
    </span>
  );
}

/* ── Card ─────────────────────────────────────────────── */
export function Card({ children, style: extra, noPad }) {
  return <div style={{ ...S.card, ...(noPad ? { padding: 0, overflow: 'hidden' } : {}), ...extra }}>{children}</div>;
}

/* ── FormGroup ────────────────────────────────────────── */
export function FormGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block', fontWeight: 500 }}>{label}</label>}
      {children}
    </div>
  );
}

/* ── FormRow ──────────────────────────────────────────── */
export function FormRow({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

/* ── Alert ────────────────────────────────────────────── */
export function Alert({ children, type = 'info' }) {
  const types = {
    info:    { bg: '#4f8ef715', border: '#4f8ef740', color: '#4f8ef7' },
    warning: { bg: '#f59e0b15', border: '#f59e0b40', color: '#f59e0b' },
    success: { bg: '#10b98115', border: '#10b98140', color: '#10b981' },
    danger:  { bg: '#ef444415', border: '#ef444440', color: '#ef4444' },
  };
  const c = types[type] || types.info;
  return (
    <div style={{ padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 14,
      display: 'flex', alignItems: 'flex-start', gap: 10, background: c.bg,
      border: `1px solid ${c.border}`, color: c.color }}>
      {children}
    </div>
  );
}

/* ── Avatar ───────────────────────────────────────────── */
export function Avatar({ name, size = 44, color = '#4f8ef7' }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color + '30',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.32, color, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

/* ── SectionTitle ─────────────────────────────────────── */
export function SectionTitle({ icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────── */
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
  },
  modal: {
    background: '#171b26', border: '1px solid #2a3350', borderRadius: 16,
    padding: 24, width: '100%', maxHeight: '90vh', overflowY: 'auto',
  },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  closeBtn: {
    background: '#1e2435', border: 'none', color: '#94a3b8', width: 28, height: 28,
    borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  btn: {
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  btnSm: { padding: '5px 12px', fontSize: 12 },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  variants: {
    primary: { background: '#4f8ef7', color: '#fff' },
    ghost:   { background: 'transparent', color: '#94a3b8', border: '1px solid #2a3350' },
    danger:  { background: '#ef4444', color: '#fff' },
    success: { background: '#10b981', color: '#fff' },
    purple:  { background: '#7c3aed', color: '#fff' },
  },
  card: {
    background: '#171b26', border: '1px solid #2a3350',
    borderRadius: 12, padding: 20,
  },
};
