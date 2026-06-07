import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// ── Check if this is a public school page URL ──────────────────
// /school/:slug — render PublicPageLoader, skip App entirely
const path = window.location.pathname;
const isPublicSchoolPage = path.startsWith('/school/') && path.length > 8;
const publicSlug = isPublicSchoolPage
  ? path.split('/school/')[1].replace(/\/+$/, '')
  : '';

if (isPublicSchoolPage) {
  // Lazy load only what's needed for the public page
  const { default: PublicPage }   = await import('./components/PublicPage').catch(() => ({ default: null }));
  const { supabaseClient, loadSchoolData } = await import('./supabase').catch(() => ({}));

  async function renderPublicPage() {
    // Show loading first
    root.render(
      <React.StrictMode>
        <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#eff6ff,#f0fdf4)', fontFamily:'sans-serif' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🏫</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#1e40af', marginBottom:6 }}>EduManage Pro</div>
          <div style={{ fontSize:14, color:'#64748b' }}>Loading school page...</div>
        </div>
      </React.StrictMode>
    );

    try {
      // Find school by slug
      const { data: rows, error } = await supabaseClient
        .from('schools')
        .select('id, school_slug')
        .eq('school_slug', publicSlug)
        .limit(1);

      if (error || !rows || rows.length === 0) {
        throw new Error('School not found');
      }

      // Load full school data
      const schoolData = await loadSchoolData(rows[0].id);
      if (!schoolData) throw new Error('Could not load school data');

      // Render the public page
      root.render(
        <React.StrictMode>
          <PublicPage
            data={schoolData}
            onLoginClick={() => { window.location.href = '/'; }}
          />
        </React.StrictMode>
      );
    } catch (err) {
      console.error('Public page error:', err);
      // Show not found
      root.render(
        <React.StrictMode>
          <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc', fontFamily:'sans-serif' }}>
            <div style={{ textAlign:'center', maxWidth:440, padding:32 }}>
              <div style={{ fontSize:64, marginBottom:16 }}>🔍</div>
              <div style={{ fontSize:22, fontWeight:900, color:'#1e293b', marginBottom:10 }}>School not found</div>
              <div style={{ fontSize:13, color:'#64748b', marginBottom:24 }}>
                No school found at <b>/school/{publicSlug}</b>.<br />
                The school may not have set up their public page yet, or the link may be incorrect.
              </div>
              <a href="/" style={{ padding:'11px 28px', background:'#1e40af', color:'#fff', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:15 }}>
                Back to Login
              </a>
            </div>
          </div>
        </React.StrictMode>
      );
    }
  }

  renderPublicPage();

} else {
  // Normal app — load App component as usual
  const { default: App } = await import('./App');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
