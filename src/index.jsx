import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import PublicPage from './components/PublicPage';
import { supabaseClient, loadSchoolData } from './supabase';

const root = ReactDOM.createRoot(document.getElementById('root'));

const path  = window.location.pathname;
const isPublicRoute = path.startsWith('/school/') && path.length > 8;
const slug  = isPublicRoute ? path.replace('/school/', '').replace(/\/+$/, '') : '';

/* ── Public school page ─────────────────────────────────────────
   When URL is /school/:slug, render PublicPage directly.
   App.jsx never loads — no auth, no login, no 22 queries.
────────────────────────────────────────────────────────────────*/
function PublicRoot({ slug }) {
  const [state, setState] = React.useState('loading'); // loading | found | notfound
  const [schoolData, setSchoolData] = React.useState(null);

  React.useEffect(() => {
    async function load() {
      try {
        const { data: rows, error } = await supabaseClient
          .from('schools')
          .select('id')
          .eq('school_slug', slug)
          .limit(1);

        if (error || !rows || rows.length === 0) {
          setState('notfound');
          return;
        }

        const data = await loadSchoolData(rows[0].id);
        if (data) {
          setSchoolData(data);
          setState('found');
        } else {
          setState('notfound');
        }
      } catch (e) {
        console.error('PublicRoot error:', e);
        setState('notfound');
      }
    }
    load();
  }, [slug]);

  if (state === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏫</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>EduManage Pro</div>
      <div style={{ fontSize: 14, color: '#64748b' }}>Loading school page...</div>
    </div>
  );

  if (state === 'notfound') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 440, padding: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', marginBottom: 10 }}>School not found</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
          No school found at <b>/school/{slug}</b>.
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 24 }}>
          The school may not have set up their public page yet. Make sure the admin has saved the school slug in Settings.
        </div>
        <a href="/" style={{ padding: '11px 28px', background: '#1e40af', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>
          Back to Login
        </a>
      </div>
    </div>
  );

  return (
    <PublicPage
      data={schoolData}
      onLoginClick={() => { window.location.href = '/'; }}
    />
  );
}

/* ── Entry point ────────────────────────────────────────────────*/
if (isPublicRoute) {
  // Public school page — never load App
  root.render(
    <React.StrictMode>
      <PublicRoot slug={slug} />
    </React.StrictMode>
  );
} else {
  // Normal app — load App as usual
  import('./App').then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}
