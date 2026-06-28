import React, { useState, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════
   AUDIT LOG SYSTEM
   ──────────────────────────────────────────────────────────────
   • Every login (staff, student, parent) is logged to Supabase
   • Every significant action (add student, enter marks, etc) is logged
   • Developer views ALL schools via same password as License system
   • School admin sees ONLY their own school's logs
   • Same Netlify function used for developer password verification
   • Logs stored in `audit_logs` table in Supabase (separate from schools)
═══════════════════════════════════════════════════════════════ */

const GENERATE_TOKEN_URL = '/.netlify/functions/generate-token';

/* ── Action type labels ─────────────────────────────────────── */
const ACTION_LABELS = {
  login_staff:      { label: 'Staff Login',       icon: '👤', color: '#4f8ef7' },
  login_student:    { label: 'Student Login',      icon: '🎒', color: '#10b981' },
  login_parent:     { label: 'Parent Login',       icon: '👨‍👩‍👧', color: '#10b981' },
  logout:           { label: 'Logout',             icon: '🚪', color: 'var(--text-muted)' },
  add_student:      { label: 'Added Student',      icon: '➕', color: '#7c3aed' },
  delete_student:   { label: 'Deleted Student',    icon: '🗑️', color: '#ef4444' },
  add_staff:        { label: 'Added Staff',        icon: '➕', color: '#7c3aed' },
  edit_staff:       { label: 'Edited Staff',       icon: '✏️', color: '#f59e0b' },
  delete_staff:     { label: 'Deleted Staff',      icon: '🗑️', color: '#ef4444' },
  enter_marks:      { label: 'Entered Marks',      icon: '📝', color: '#4f8ef7' },
  create_exam:      { label: 'Created Exam',       icon: '📋', color: '#7c3aed' },
  record_payment:   { label: 'Recorded Payment',   icon: '💰', color: '#10b981' },
  send_message:     { label: 'Sent Message',       icon: '💬', color: '#4f8ef7' },
  promote_students: { label: 'Promoted Students',  icon: '🎓', color: '#10b981' },
  settings_change:  { label: 'Changed Settings',   icon: '⚙️', color: '#f59e0b' },
  print:            { label: 'Printed Document',   icon: '🖨️', color: 'var(--text-muted)' },
  online_application:{ label: 'Online Application',icon: '🌐', color: '#7c3aed' },
  job_application:  { label: 'Job Application',    icon: '💼', color: '#7c3aed' },
};

/* ── Log an action — called from anywhere in the app ────────── */
export async function logAction(schoolId, schoolName, user, action, details = '') {
  try {
    const entry = {
      school_id:   schoolId,
      school_name: schoolName,
      user_name:   user?.name   || user?.email || 'Unknown',
      user_role:   user?.role   || user?.staffType || 'unknown',
      user_id:     user?.staffId|| user?.id    || null,
      action,
      details,
      ip:          null, // browser can't reliably get IP
      timestamp:   new Date().toISOString(),
    };

    // Dynamically import supabase to avoid circular deps
    const { getSupabase } = await import('../supabase');
    await getSupabase().from('audit_logs').insert(entry);
  } catch (e) {
    // Audit log failure should never break the app
    console.warn('Audit log failed:', e);
  }
}

/* ── DEVELOPER VIEW — sees all schools ──────────────────────── */
function DeveloperAuditView() {
  const [logs,      setLogs]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [filter,    setFilter]    = useState({ school:'', action:'', role:'', search:'' });
  const [page,      setPage]      = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => { fetchLogs(); }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const { getSupabase } = await import('../supabase');
      const { data, error } = await getSupabase()
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(2000);
      if (!error && data) setLogs(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  const schools = [...new Set(logs.map(l=>l.school_name).filter(Boolean))].sort();
  const actions = [...new Set(logs.map(l=>l.action).filter(Boolean))].sort();
  const roles   = [...new Set(logs.map(l=>l.user_role).filter(Boolean))].sort();

  const filtered = logs.filter(l => {
    if (filter.school && l.school_name!==filter.school) return false;
    if (filter.action && l.action!==filter.action)       return false;
    if (filter.role   && l.user_role!==filter.role)      return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!(l.user_name||'').toLowerCase().includes(q) &&
          !(l.details||'').toLowerCase().includes(q)   &&
          !(l.school_name||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const pages    = Math.ceil(filtered.length/PAGE_SIZE);
  const pageLogs = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // Stats
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = logs.filter(l=>(l.timestamp||'').startsWith(todayStr)).length;
  const loginCount = logs.filter(l=>(l.action||'').startsWith('login')).length;
  const schoolCount = schools.length;

  return (
    <div style={{ fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', minHeight:'100vh', background:'var(--bg)', padding:24, color:'var(--text)' }}>
      <div style={{ maxWidth:1400, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11,color:'var(--text-muted)',letterSpacing:2,textTransform:'uppercase',marginBottom:6 }}>Developer Console</div>
          <h1 style={{ fontSize:28,fontWeight:900,color:'var(--text)',margin:0 }}>📋 Audit Log — All Schools</h1>
          <div style={{ fontSize:13,color:'var(--text-muted)',marginTop:4 }}>Full activity log across every school on the platform</div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24 }}>
          {[
            { l:'Total Events',   v:logs.length,    c:'#4f8ef7' },
            { l:'Today',          v:todayCount,      c:'#10b981' },
            { l:'Total Logins',   v:loginCount,      c:'#7c3aed' },
            { l:'Active Schools', v:schoolCount,     c:'#f59e0b' },
          ].map(s=>(
            <div key={s.l} style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'18px 20px' }}>
              <div style={{ fontSize:28,fontWeight:900,color:s.c }}>{s.v}</div>
              <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex',gap:10,marginBottom:16,flexWrap:'wrap' }}>
          <input value={filter.search} onChange={e=>{ setFilter(f=>({...f,search:e.target.value}));setPage(1); }}
            placeholder="Search user, school, details..." style={INP} />
          <select value={filter.school} onChange={e=>{ setFilter(f=>({...f,school:e.target.value}));setPage(1); }} style={SEL}>
            <option value="">All Schools</option>
            {schools.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filter.action} onChange={e=>{ setFilter(f=>({...f,action:e.target.value}));setPage(1); }} style={SEL}>
            <option value="">All Actions</option>
            {actions.map(a=><option key={a} value={a}>{ACTION_LABELS[a]?.label||a}</option>)}
          </select>
          <select value={filter.role} onChange={e=>{ setFilter(f=>({...f,role:e.target.value}));setPage(1); }} style={SEL}>
            <option value="">All Roles</option>
            {roles.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={fetchLogs} style={{ padding:'9px 18px',background:'var(--border)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text-sub)',cursor:'pointer',fontSize:13 }}>
            🔄 Refresh
          </button>
          <span style={{ fontSize:13,color:'var(--text-muted)',alignSelf:'center',marginLeft:'auto' }}>
            {filtered.length} events
          </span>
        </div>

        {/* Table */}
        <div style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--surface2)' }}>
                {['Timestamp','School','User','Role','Action','Details'].map(h=>(
                  <th key={h} style={{ textAlign:'left',padding:'12px 16px',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:0.5,borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding:40,textAlign:'center',color:'var(--text-muted)' }}>Loading...</td></tr>
              ) : pageLogs.length===0 ? (
                <tr><td colSpan={6} style={{ padding:40,textAlign:'center',color:'var(--text-muted)' }}>No logs found.</td></tr>
              ) : pageLogs.map((log,i)=>{
                const act = ACTION_LABELS[log.action]||{ label:log.action,icon:'📌',color:'var(--text-muted)' };
                return (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'11px 16px',color:'var(--text-muted)',whiteSpace:'nowrap',fontSize:12 }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('en-KE') : '—'}
                    </td>
                    <td style={{ padding:'11px 16px' }}>
                      <span style={{ background:'#4f8ef720',color:'#4f8ef7',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700 }}>
                        {log.school_name||'—'}
                      </span>
                    </td>
                    <td style={{ padding:'11px 16px',fontWeight:600,color:'var(--text)' }}>{log.user_name||'—'}</td>
                    <td style={{ padding:'11px 16px',color:'var(--text-sub)',fontSize:12 }}>{log.user_role||'—'}</td>
                    <td style={{ padding:'11px 16px' }}>
                      <span style={{ color:act.color,fontWeight:600 }}>{act.icon} {act.label}</span>
                    </td>
                    <td style={{ padding:'11px 16px',color:'var(--text-sub)',fontSize:12,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                      {log.details||'—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages>1 && (
          <div style={{ display:'flex',gap:8,justifyContent:'center',marginTop:16 }}>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
              style={{ ...PBTN, opacity:page===1?0.4:1 }}>← Prev</button>
            <span style={{ fontSize:13,color:'var(--text-muted)',alignSelf:'center' }}>Page {page} of {pages}</span>
            <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}
              style={{ ...PBTN, opacity:page===pages?0.4:1 }}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SCHOOL ADMIN VIEW — sees only their school ─────────────── */
function SchoolAuditView({ data }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState({ action:'', role:'', search:'' });
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 30;

  useEffect(() => { fetchLogs(); }, []);

  async function fetchLogs() {
    if (!data._schoolId) return;
    setLoading(true);
    try {
      const { getSupabase } = await import('../supabase');
      const { data: rows, error } = await getSupabase()
        .from('audit_logs')
        .select('*')
        .eq('school_id', data._schoolId)
        .order('timestamp', { ascending: false })
        .limit(500);
      if (!error && rows) setLogs(rows);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  const actions = [...new Set(logs.map(l=>l.action).filter(Boolean))].sort();
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = logs.filter(l=>(l.timestamp||'').startsWith(todayStr)).length;
  const loginCount = logs.filter(l=>(l.action||'').startsWith('login')).length;

  const filtered = logs.filter(l=>{
    if (filter.action && l.action!==filter.action) return false;
    if (filter.role   && l.user_role!==filter.role) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!(l.user_name||'').toLowerCase().includes(q) && !(l.details||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const pages    = Math.ceil(filtered.length/PAGE_SIZE);
  const pageLogs = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return (
    <div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20 }}>
        {[
          { l:'Total Events', v:logs.length,  c:'#4f8ef7' },
          { l:'Today',        v:todayCount,    c:'#10b981' },
          { l:'Logins',       v:loginCount,    c:'#7c3aed' },
        ].map(s=>(
          <div key={s.l} style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px' }}>
            <div style={{ fontSize:22,fontWeight:900,color:s.c }}>{s.v}</div>
            <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex',gap:8,marginBottom:14,flexWrap:'wrap' }}>
        <input value={filter.search} onChange={e=>{ setFilter(f=>({...f,search:e.target.value}));setPage(1); }}
          placeholder="Search by user or action..." style={INP} />
        <select value={filter.action} onChange={e=>{ setFilter(f=>({...f,action:e.target.value}));setPage(1); }} style={SEL}>
          <option value="">All Actions</option>
          {actions.map(a=><option key={a} value={a}>{ACTION_LABELS[a]?.label||a}</option>)}
        </select>
        <button onClick={fetchLogs} style={{ padding:'9px 16px',background:'var(--border)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text-sub)',cursor:'pointer',fontSize:13 }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
          <thead>
            <tr style={{ background:'var(--surface2)' }}>
              {['Time','User','Role','Action','Details'].map(h=>(
                <th key={h} style={{ textAlign:'left',padding:'11px 14px',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',borderBottom:'1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding:32,textAlign:'center',color:'var(--text-muted)' }}>Loading...</td></tr>
            ) : pageLogs.length===0 ? (
              <tr><td colSpan={5} style={{ padding:32,textAlign:'center',color:'var(--text-muted)' }}>No activity logged yet.</td></tr>
            ) : pageLogs.map((log,i)=>{
              const act = ACTION_LABELS[log.action]||{ label:log.action,icon:'📌',color:'var(--text-muted)' };
              return (
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'10px 14px',color:'var(--text-muted)',fontSize:12,whiteSpace:'nowrap' }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleString('en-KE') : '—'}
                  </td>
                  <td style={{ padding:'10px 14px',fontWeight:600,color:'var(--text)' }}>{log.user_name||'—'}</td>
                  <td style={{ padding:'10px 14px',color:'var(--text-sub)',fontSize:12 }}>{log.user_role||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ color:act.color,fontWeight:600 }}>{act.icon} {act.label}</span>
                  </td>
                  <td style={{ padding:'10px 14px',color:'var(--text-sub)',fontSize:12,maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                    {log.details||'—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages>1 && (
        <div style={{ display:'flex',gap:8,justifyContent:'center',marginTop:12 }}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ ...PBTN,opacity:page===1?0.4:1 }}>← Prev</button>
          <span style={{ fontSize:13,color:'var(--text-muted)',alignSelf:'center' }}>Page {page} of {pages}</span>
          <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages} style={{ ...PBTN,opacity:page===pages?0.4:1 }}>Next →</button>
        </div>
      )}
    </div>
  );
}

/* ── MAIN EXPORT — developer gate same as LicenseSystem ─────── */
export default function AuditLog({ data, isDevMode = false , isDark, themeVars }) {
  const _bg = themeVars ? themeVars['--bg'] : 'var(--bg)';
  const _surface = themeVars ? themeVars['--surface'] : 'var(--surface)';
  const _text = themeVars ? themeVars['--text'] : 'var(--text)';

  const [devPass, setDevPass]   = useState('');
  const [authed,  setAuthed]    = useState(false);
  const [passErr, setPassErr]   = useState('');
  const [loading, setLoading]   = useState(false);

  // If isDevMode is true, we're accessed via the same developer route as license
  if (!isDevMode) {
    return <SchoolAuditView data={data} />;
  }

  if (!authed) {
    return (
      <div style={{ minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
        <div style={{ background:'var(--surface)',border:'1px solid #7c3aed40',borderRadius:16,padding:32,width:'100%',maxWidth:400 }}>
          <div style={{ fontSize:14,fontWeight:700,color:'#7c3aed',marginBottom:4 }}>🔑 Developer Access</div>
          <div style={{ fontSize:18,fontWeight:800,color:'var(--text)',marginBottom:4 }}>Audit Log Console</div>
          <div style={{ fontSize:13,color:'var(--text-muted)',marginBottom:20 }}>All schools · All activity</div>
          <input type="password" value={devPass} onChange={e=>setDevPass(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&checkPassword()}
            placeholder="Developer password"
            style={{ width:'100%',padding:'11px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontSize:14,outline:'none',boxSizing:'border-box',marginBottom:10 }} />
          {passErr && <div style={{ fontSize:12,color:'#ef4444',marginBottom:10 }}>{passErr}</div>}
          <button onClick={checkPassword} disabled={loading||!devPass} style={{ width:'100%',padding:12,background:'#7c3aed',border:'none',borderRadius:8,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
            {loading?'Verifying...':'Unlock →'}
          </button>
        </div>
      </div>
    );
  }

  return <DeveloperAuditView />;

  async function checkPassword() {
    if (!devPass) return;
    setLoading(true); setPassErr('');
    try {
      const res  = await fetch(GENERATE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ action:'verify', password:devPass }),
      });
      const json = await res.json();
      if (json.ok) setAuthed(true);
      else setPassErr('Wrong password. Try again.');
    } catch { setPassErr('Connection error. Try again.'); }
    finally { setLoading(false); }
  }
}

/* ── Shared styles ────────────────────────────────────────────── */
const INP = { flex:1,minWidth:180,padding:'9px 12px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontSize:13,outline:'none' };
const SEL = { padding:'9px 12px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontSize:13,outline:'none' };
const PBTN = { padding:'8px 18px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text-sub)',cursor:'pointer',fontSize:13 };
