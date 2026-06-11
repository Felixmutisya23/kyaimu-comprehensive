import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

const path = window.location.pathname;
const isPublicRoute = path.startsWith('/school/') && path.length > 8;
const publicSlug = isPublicRoute
  ? path.replace('/school/', '').replace(/\/+$/, '')
  : '';

if (isPublicRoute) {
  // ── Public school page — load only what's needed ──────────
  Promise.all([
    import('./components/PublicPage'),
    import('./supabase'),
  ]).then(([{ default: PublicPage }, { supabaseClient, loadSchoolData }]) => {

    function PublicRoot() {
      const [state, setState]       = React.useState('loading');
      const [schoolData, setSchoolData] = React.useState(null);

      React.useEffect(() => {
        async function load() {
          try {
            const { data: rows, error } = await supabaseClient
              .from('schools')
              .select('id')
              .eq('school_slug', publicSlug)
              .limit(1);

            if (error || !rows || !rows.length) { setState('notfound'); return; }

            const d = await loadSchoolData(rows[0].id);
            if (d) { setSchoolData(d); setState('found'); }
            else setState('notfound');
          } catch(e) {
            console.error('PublicRoot error:', e);
            setState('notfound');
          }
        }
        load();
      }, []);

      if (state === 'loading') return (
        <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#eff6ff,#f0fdf4)', fontFamily:'sans-serif' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🏫</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#1e40af', marginBottom:6 }}>EduManage Pro</div>
          <div style={{ fontSize:14, color:'#64748b' }}>Loading school page...</div>
        </div>
      );

      if (state === 'notfound') return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc', fontFamily:'sans-serif' }}>
          <div style={{ textAlign:'center', maxWidth:440, padding:32 }}>
            <div style={{ fontSize:64, marginBottom:16 }}>🔍</div>
            <div style={{ fontSize:22, fontWeight:900, color:'#1e293b', marginBottom:10 }}>School not found</div>
            <div style={{ fontSize:13, color:'#64748b', marginBottom:24 }}>
              No school found at <b>/school/{publicSlug}</b>. The link may be incorrect or the school may not have set up their public page yet.
            </div>
            <a href="/" style={{ padding:'11px 28px', background:'#1e40af', color:'#fff', borderRadius:10, textDecoration:'none', fontWeight:700 }}>
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

    root.render(
      <React.StrictMode>
        <PublicRoot />
      </React.StrictMode>
    );

  }).catch(err => {
    console.error('Failed to load public page:', err);
    document.getElementById('root').innerHTML =
      '<div style="padding:40px;text-align:center;font-family:sans-serif;color:#64748b"><h2>Failed to load page</h2><p>Please refresh and try again.</p><a href="/">Go to Login</a></div>';
  });

} else {
  // ── Normal app — static import so Vite bundles correctly ──
  import('./App').then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }).catch(err => {
    console.error('App failed to load:', err);
    // Show error details to help debug
    document.getElementById('root').innerHTML =
      `<div style="padding:40px;font-family:sans-serif;color:#ef4444;background:#fff;min-height:100vh">
        <h2>Application Error</h2>
        <p>The app failed to start. Please try:</p>
        <ul style="margin:16px 0;line-height:2">
          <li>Hard refresh: <strong>Ctrl+Shift+R</strong></li>
          <li>Clear browser cache and retry</li>
        </ul>
        <p style="font-size:12px;color:#94a3b8;margin-top:24px">Error: ${err?.message || 'Unknown error'}</p>
      </div>`;
  });
}
