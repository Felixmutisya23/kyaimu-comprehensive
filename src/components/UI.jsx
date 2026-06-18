import React from 'react';
import { getGrade } from '../data/initialData';

/* ════════════════════════════════════════════════════════════
   UI.jsx — all components use CSS variables so light / dark
   theme switching works instantly across the whole app.

   Variables set by App.jsx theme effect:
     --bg            page background
     --surface       card / sidebar background
     --surface2      inputs, table rows, secondary panels
     --border        borders & dividers
     --text          primary text
     --text-sub      secondary text
     --text-muted    placeholder / muted text
     --input-bg      input / select background
     --input-color   input text colour
     --accent        primary accent (blue)
     --card-shadow   card box-shadow
   ════════════════════════════════════════════════════════════ */

/* ─── Global input/select styles injected once ─────────────── */
const GLOBAL_STYLE = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  input, select, textarea {
    background: var(--input-bg);
    color: var(--input-color);
    border: 1.5px solid var(--border);
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 13px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='%2394a3b8' d='M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 18px;
    padding-right: 34px;
    cursor: pointer;
  }
  input[type="date"] { cursor: pointer; }
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { opacity: 1; }
  input::placeholder, textarea::placeholder { color: var(--text-muted); }
  /* Scrollbars */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 6px; }
  /* Mobile: make form rows stack */
  @media (max-width: 600px) {
    .edu-form-row { grid-template-columns: 1fr !important; }
  }
`;

let injected = false;
function injectGlobal() {
  if (injected) return;
  injected = true;
  const el = document.createElement('style');
  el.textContent = GLOBAL_STYLE;
  document.head.appendChild(el);
}

/* ── Icon ─────────────────────────────────────────────────── */
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
  alert:       'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  back:        'M19 12H5M12 19l-7-7 7-7',
  money:       'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  user:        'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  logout:      'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  clock:       'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  book:        'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  star:        'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z',
  alert2:      'M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  status:      'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z',
};

export function Icon({ name, size = 18, color }) {
  injectGlobal();
  const d = PATHS[name] || PATHS.dashboard;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || 'currentColor'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

/* ── Modal ─────────────────────────────────────────────────── */
export function Modal({ show, onClose, title, children, wide }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 24, width: '100%',
        maxWidth: wide ? 820 : 600,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text-sub)', width: 30, height: 30,
            borderRadius: 8, cursor: 'pointer', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Button ────────────────────────────────────────────────── */
const VARIANT_STYLES = {
  primary: { background: 'var(--accent)', color: '#fff',      border: 'none' },
  ghost:   { background: 'transparent',   color: 'var(--text-sub)', border: '1.5px solid var(--border)' },
  danger:  { background: '#ef4444',       color: '#fff',      border: 'none' },
  success: { background: '#10b981',       color: '#fff',      border: 'none' },
  purple:  { background: '#7c3aed',       color: '#fff',      border: 'none' },
  outline: { background: 'transparent',   color: 'var(--accent)', border: `1.5px solid var(--accent)` },
};

export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, style: extra }) {
  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...v,
        padding: size === 'sm' ? '5px 12px' : '9px 18px',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: size === 'sm' ? 12 : 13,
        fontWeight: 600,
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.15s, transform 0.1s',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap',
        ...extra,
      }}
    >
      {children}
    </button>
  );
}

/* ── GradeBadge ────────────────────────────────────────────── */
export function GradeBadge({ score }) {
  const g = getGrade(score);
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: g.color + '25', color: g.color, border: `1px solid ${g.color}40`,
      display: 'inline-block',
    }}>
      {g.label} ({g.points}pts)
    </span>
  );
}

/* ── ProgressBar ───────────────────────────────────────────── */
export function ProgressBar({ pct, color }) {
  const c = color || (pct >= 100 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444');
  return (
    <div style={{ background: 'var(--border)', borderRadius: 20, height: 6, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', borderRadius: 20, width: `${Math.min(pct, 100)}%`, background: c, transition: 'width 0.3s' }} />
    </div>
  );
}

/* ── Tag ───────────────────────────────────────────────────── */
export function Tag({ children, color = 'blue' }) {
  const colors = {
    blue:   { bg: '#3b82f620', text: '#3b82f6' },
    green:  { bg: '#10b98120', text: '#10b981' },
    amber:  { bg: '#f59e0b20', text: '#d97706' },
    red:    { bg: '#ef444420', text: '#ef4444' },
    purple: { bg: '#7c3aed20', text: '#7c3aed' },
    gray:   { bg: 'var(--surface2)', text: 'var(--text-muted)' },
  };
  const c = colors[color] || colors.blue;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.text,
      border: `1px solid ${c.text}30`,
    }}>
      {children}
    </span>
  );
}

/* ── Card ──────────────────────────────────────────────────── */
export function Card({ children, style: extra, noPad }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: noPad ? 0 : 20,
      overflow: noPad ? 'hidden' : undefined,
      boxShadow: 'var(--card-shadow)',
      ...extra,
    }}>
      {children}
    </div>
  );
}

/* ── FormGroup ─────────────────────────────────────────────── */
export function FormGroup({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 5, display: 'block', fontWeight: 600 }}>
          {label}
        </label>
      )}
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/* ── FormRow ───────────────────────────────────────────────── */
export function FormRow({ children }) {
  return (
    <div className="edu-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {children}
    </div>
  );
}

/* ── Alert ─────────────────────────────────────────────────── */
export function Alert({ children, type = 'info', style: extra, onClick }) {
  const types = {
    info:    { bg: '#3b82f612', border: '#3b82f640', color: '#3b82f6' },
    warning: { bg: '#f59e0b12', border: '#f59e0b40', color: '#d97706' },
    success: { bg: '#10b98112', border: '#10b98140', color: '#10b981' },
    danger:  { bg: '#ef444412', border: '#ef444440', color: '#ef4444' },
  };
  const c = types[type] || types.info;
  return (
    <div onClick={onClick} style={{
      padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 14,
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      ...extra,
    }}>
      {children}
    </div>
  );
}

/* ── Avatar ────────────────────────────────────────────────── */
export function Avatar({ name, size = 44, color = '#3b82f6' }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '22',
      border: `2px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.32, color, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

/* ── SectionTitle ──────────────────────────────────────────── */
export function SectionTitle({ icon, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 14, fontWeight: 700, color: 'var(--text)',
      marginBottom: 16,
    }}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </div>
  );
}
