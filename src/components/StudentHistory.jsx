import React, { useState } from 'react';
import { Card, Btn, Tag, SectionTitle, GradeBadge, Avatar, Icon } from './UI';
import { getGrade, getScore, GRADES_CBC, getSiblingStreams } from '../data/initialData';
import { computeRankings } from '../utils/print';
import { getStudentFeeSummary, getTotalPaidAllTime } from './FeesModule';

/* ─────────────────────────────────────────────────────────────────
   LIGHT THEME TOKENS
───────────────────────────────────────────────────────────────── */
const L = {
  bg:       '#f8fafc',
  card:     '#ffffff',
  border:   'var(--text)',
  text:     '#1e293b',
  sub:      'var(--text-muted)',
  primary:  '#1e40af',
  accent:   '#10b981',
  warning:  '#f59e0b',
  danger:   '#ef4444',
  gradient: 'linear-gradient(135deg,#1e40af,#7c3aed)',
};

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: L.card, border: `1.5px solid ${L.border}`, borderRadius: 14, padding: '20px 16px', textAlign: 'center', boxShadow: '0 2px 8px #0000000a' }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || L.primary, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: L.sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

/* ── Inject responsive CSS once (mobile-first overrides) ──────── */
let _portalCssInjected = false;
function injectPortalCSS() {
  if (_portalCssInjected) return;
  _portalCssInjected = true;
  const el = document.createElement('style');
  el.textContent = `
    .sp-header-inner { max-width: 1000px; margin: 0 auto; padding: 0 16px; }
    .sp-content      { max-width: 1000px; margin: 0 auto; padding: 16px; }
    .sp-tabs         { display: flex; gap: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .sp-tabs::-webkit-scrollbar { display: none; }
    .sp-tab-btn      { flex-shrink: 0; white-space: nowrap; }
    .sp-banner       { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .sp-stat-grid    { display: grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap: 12px; }
    .sp-fee-grid     { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
    .sp-profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .sp-top-row      { display: flex; justify-content: space-between; align-items: center; height: auto; min-height: 64px; padding: 10px 0; flex-wrap: wrap; gap: 8px; }
    .sp-child-row    { display: flex; gap: 8px; padding-bottom: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    @media (max-width: 640px) {
      .sp-header-inner { padding: 0 12px; }
      .sp-content      { padding: 12px; }
      .sp-fee-grid     { grid-template-columns: 1fr; }
      .sp-profile-grid { grid-template-columns: 1fr; }
      .sp-banner       { padding: 22px 18px !important; }
      .sp-banner-title { font-size: 18px !important; }
      .sp-stat-grid    { grid-template-columns: repeat(2,1fr) !important; gap: 10px !important; }
      .sp-tab-btn      { padding: 10px 14px !important; font-size: 12px !important; }
      .sp-school-name  { font-size: 13px !important; }
      .sp-welcome-row  { flex-direction: column; align-items: flex-start !important; }
      .sp-login-box    { width: 100%; }
    }
    @media (max-width: 420px) {
      .sp-stat-grid    { grid-template-columns: 1fr 1fr !important; }
    }
  `;
  document.head.appendChild(el);
}

/* ─────────────────────────────────────────────────────────────────
   STUDENT HISTORY COMPONENT (shared by Student + Parent portals)
───────────────────────────────────────────────────────────────── */
export function StudentHistory({ student, data, compact = false }) {
  const [expandedYear, setExpandedYear] = useState(null);
  if (!student) return null;
  const history = buildStudentHistory(student, data);

  if (history.length === 0) {
    return (
      <div style={{ background: L.card, border: `1.5px solid ${L.border}`, borderRadius: 14, padding: 40, textAlign: 'center', color: L.sub }}>
        No academic history yet for {student.name}.
      </div>
    );
  }

  return (
    <div>
      {!compact && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
            <StatCard icon="📚" label="Years at School" value={history.length} color={L.primary} />
            <StatCard icon="📝" label="Exams Taken" value={history.reduce((a,y)=>a+(y.exams||[]).length,0)} color={L.accent} />
            <StatCard icon="🏫" label="Current Class" value={student.class||'—'} color={L.warning} />
            <StatCard icon="✅" label="Status" value={student.status||'Active'} color={!student.status||student.status==='active'?L.accent:L.danger} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {history.map((yearData, yi) => (
          <div key={yi} style={{ background: L.card, border: `1.5px solid ${L.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px #0000000a' }}>
            <div onClick={() => setExpandedYear(expandedYear===yi?null:yi)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer', background: expandedYear===yi ? '#f0f9ff' : L.card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: L.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>
                  {String(yearData.year).slice(-2)}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: L.text }}>{yearData.year} · {yearData.class}</div>
                  <div style={{ fontSize: 12, color: L.sub }}>{yearData.exams.length} exam{yearData.exams.length!==1?'s':''} recorded</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {yearData.promoted && <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>✅ Promoted</span>}
                {yearData.overallMean !== null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: L.accent }}>{yearData.overallMean}%</div>
                    <div style={{ fontSize: 10, color: L.sub }}>Overall</div>
                  </div>
                )}
                <span style={{ color: L.sub, fontSize: 14 }}>{expandedYear===yi?'▲':'▼'}</span>
              </div>
            </div>
            {expandedYear===yi && (
              <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${L.border}` }}>
                {yearData.exams.length===0
                  ? <div style={{ color: L.sub, fontSize: 13, padding: '16px 0' }}>No exam records for this year.</div>
                  : [1,2,3].map(term => {
                    const termExams = yearData.exams.filter(e=>e.term===term);
                    if (!termExams.length) return null;
                    return (
                      <div key={term} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: L.warning, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, paddingTop: 16, borderTop: `1px solid ${L.border}` }}>
                          Term {term}
                        </div>
                        {termExams.map((exam, ei) => <ExamCard key={ei} exam={exam} student={student} data={data} />)}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExamCard({ exam, student, data }) {
  const results  = exam.results?.[student.name] || {};
  const subjects = Object.keys(results);
  const scores   = subjects.map(s=>getScore(results[s])).filter(v=>v!==null);
  const total    = scores.reduce((a,b)=>a+b,0);
  const mean     = scores.length ? Math.round(total/scores.length) : null;
  const { posMap, hasStreams } = subjects.length>0 ? computeRankings(exam,data.students||[],data) : {posMap:{},hasStreams:false};
  const pos = posMap[student.name] || {};

  return (
    <div style={{ background: L.bg, borderRadius: 10, padding: '14px 16px', marginBottom: 8, border: `1px solid ${L.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: subjects.length>0?12:0 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: L.text }}>{exam.name}</div>
          <div style={{ fontSize: 11, color: L.sub }}>{exam.type||''}</div>
        </div>
        {mean!==null && (
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: mean>=60?L.accent:mean>=40?L.warning:L.danger }}>{mean}%</div>
              <GradeBadge score={mean} />
            </div>
            {pos.overallPos && (
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 11, background: '#fef2f2', color: L.danger, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                  Overall: {pos.overallPos}/{pos.overallOf}
                </span>
                {hasStreams && pos.streamPos && (
                  <span style={{ fontSize: 11, background: '#eff6ff', color: L.primary, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                    Stream: {pos.streamPos}/{pos.streamOf}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {subjects.length>0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {subjects.map(sub => {
            const score = getScore(results[sub]);
            return (
              <div key={sub} style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 8, padding: '5px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: L.sub }}>{sub}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: score!==null?(score>=60?L.accent:score>=40?L.warning:L.danger):L.sub }}>
                  {score!==null?score:'—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {subjects.length===0 && <div style={{ fontSize: 12, color: L.sub }}>No scores recorded yet.</div>}
    </div>
  );
}

function buildStudentHistory(student, data) {
  const exams = data.exams || [];
  const promotionHistory = data.promotionHistory || [];
  const studentPromo = promotionHistory.filter(p=>p.studentId===student.id||p.studentName===student.name);
  const yearMap = {};
  exams.forEach(exam => {
    const hasResult = exam.results && exam.results[student.name]!==undefined;
    let relevantClass = null;
    const promoForYear = studentPromo.find(p=>p.year===exam.year&&p.fromClass===exam.class);
    if (promoForYear) relevantClass = exam.class;
    else if (exam.class===student.class) relevantClass = exam.class;
    else if (hasResult) relevantClass = exam.class;
    if (!relevantClass||!hasResult) return;
    const key = `${exam.year}-${relevantClass}`;
    if (!yearMap[key]) yearMap[key] = { year:exam.year, class:relevantClass, exams:[], promoted:false };
    yearMap[key].exams.push(exam);
  });
  const currentYear = data.currentYear||new Date().getFullYear();
  const currentKey  = `${currentYear}-${student.class}`;
  if (!yearMap[currentKey]&&student.class) yearMap[currentKey] = { year:currentYear, class:student.class, exams:[], promoted:false };
  studentPromo.forEach(p => { const key=`${p.year}-${p.fromClass}`; if(yearMap[key]) yearMap[key].promoted=true; });
  return Object.values(yearMap).sort((a,b)=>a.year-b.year).map(y => {
    const allScores = (y.exams||[]).flatMap(e=>{
      const res=e.results?.[student.name]||{};
      return Object.values(res).map(v=>getScore(v)).filter(v=>v!==null);
    });
    const overallMean = allScores.length ? Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length) : null;
    return {...y, overallMean};
  });
}

/* ─────────────────────────────────────────────────────────────────
   STUDENT PORTAL — light theme, rich dashboard
───────────────────────────────────────────────────────────────── */
export function StudentPortal({ student, data, onLogout }) {
  injectPortalCSS();
  const [tab, setTab] = useState('dashboard');
  const exams = (data.exams||[]).filter(e=>e.class===student.class&&e.results?.[student.name]);
  const latestExam = exams[exams.length-1];
  const latestResults = latestExam?.results?.[student.name]||{};
  const latestScores  = Object.values(latestResults).map(v=>getScore(v)).filter(v=>v!==null);
  const latestMean    = latestScores.length ? Math.round(latestScores.reduce((a,b)=>a+b,0)/latestScores.length) : null;

  const TABS = [
    { id:'dashboard', label:'🏠 Home' },
    { id:'history',   label:'📚 Results' },
    { id:'profile',   label:'👤 Profile' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:L.bg, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ background:L.gradient, boxShadow:'0 4px 20px #1e40af30' }}>
        <div className="sp-header-inner">
          <div className="sp-top-row">
            <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
              <div style={{ width:38,height:38,borderRadius:10,background:'#ffffff30',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:18,color:'#fff',flexShrink:0 }}>E</div>
              <div style={{ minWidth:0 }}>
                <div className="sp-school-name" style={{ fontSize:15,fontWeight:800,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{data.schoolName}</div>
                <div style={{ fontSize:11,color:'#bfdbfe' }}>Student Portal</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13,fontWeight:700,color:'#fff' }}>{student.name}</div>
                <div style={{ fontSize:11,color:'#bfdbfe' }}>{student.class} {student.admNo?`· ${student.admNo}`:''}</div>
              </div>
              <button onClick={onLogout} style={{ padding:'7px 14px',borderRadius:8,border:'1px solid #ffffff40',background:'transparent',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',flexShrink:0 }}>
                Logout
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="sp-tabs">
            {TABS.map(t=>(
              <button key={t.id} className="sp-tab-btn" onClick={()=>setTab(t.id)} style={{
                padding:'12px 20px',border:'none',background:'transparent',cursor:'pointer',fontSize:13,fontWeight:tab===t.id?800:500,
                color:tab===t.id?'#fff':'#93c5fd',borderBottom:`3px solid ${tab===t.id?'#fff':'transparent'}`,transition:'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="sp-content">

        {/* ── DASHBOARD ── */}
        {tab==='dashboard' && (
          <div>
            {/* Welcome banner */}
            <div className="sp-banner" style={{ background:L.gradient, borderRadius:18, padding:'28px 32px', marginBottom:24, color:'#fff' }}>
              <div className="sp-welcome-row" style={{ display:'flex', flexWrap:'wrap', gap:16, width:'100%', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div className="sp-banner-title" style={{ fontSize:22,fontWeight:900,marginBottom:4 }}>Welcome back, {student.firstName||student.name.split(' ')[0]}! 👋</div>
                  <div style={{ fontSize:13,opacity:0.85 }}>{student.class} · {new Date().toLocaleDateString('en-KE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
                </div>
                <div className="sp-login-box" style={{ background:'#ffffff20', borderRadius:12, padding:'14px 20px', textAlign:'center' }}>
                  <div style={{ fontSize:12, color:'#bfdbfe', fontWeight:600, marginBottom:4 }}>YOUR LOGIN CODE</div>
                  <div style={{ fontSize:20, fontWeight:900, letterSpacing:2 }}>{student.slc||'—'}</div>
                  <div style={{ fontSize:10, color:'#bfdbfe', marginTop:2 }}>Keep this safe — use it to login</div>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="sp-stat-grid" style={{ marginBottom:24 }}>
              <StatCard icon="📝" label="Exams Taken" value={exams.length} color={L.primary} />
              {latestMean!==null && <StatCard icon="📊" label="Latest Mean" value={`${latestMean}%`} color={latestMean>=60?L.accent:latestMean>=40?L.warning:L.danger} />}
              <StatCard icon="🏫" label="Current Class" value={student.class} color={L.primary} />
              <StatCard icon="📅" label="Year Joined" value={student.joined||'—'} color={L.sub} />
            </div>

            {/* Latest exam */}
            {latestExam && (
              <div style={{ background:L.card, border:`1.5px solid ${L.border}`, borderRadius:16, padding:24, marginBottom:24, boxShadow:'0 2px 8px #0000000a' }}>
                <div style={{ fontSize:14, fontWeight:800, color:L.text, marginBottom:16 }}>📝 Latest Exam — {latestExam.name}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                  {Object.entries(latestResults).map(([sub,val])=>{
                    const score = getScore(val);
                    return (
                      <div key={sub} style={{ background:L.bg, border:`1px solid ${L.border}`, borderRadius:10, padding:'12px 16px', textAlign:'center', minWidth:100, flex:'1 1 100px' }}>
                        <div style={{ fontSize:11, color:L.sub, marginBottom:6, fontWeight:600 }}>{sub}</div>
                        <div style={{ fontSize:22, fontWeight:900, color:score!==null?(score>=60?L.accent:score>=40?L.warning:L.danger):L.sub }}>{score!==null?score:'—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* School info */}
            <div style={{ background:L.card, border:`1.5px solid ${L.border}`, borderRadius:16, padding:24, boxShadow:'0 2px 8px #0000000a' }}>
              <div style={{ fontSize:14, fontWeight:800, color:L.text, marginBottom:16 }}>🏫 School Information</div>
              <div className="sp-profile-grid">
                {[
                  ['School',   data.schoolName],
                  ['Location', [data.schoolLocation,data.schoolCounty].filter(Boolean).join(', ')],
                  ['Phone',    data.schoolPhone],
                  ['Email',    data.schoolEmail],
                ].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l} style={{ padding:'10px 14px', background:L.bg, borderRadius:10, overflow:'hidden' }}>
                    <div style={{ fontSize:11, color:L.sub, marginBottom:3, fontWeight:600 }}>{l}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:L.text, overflowWrap:'break-word' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {tab==='history' && (
          <>
            <div style={{ fontSize:20,fontWeight:900,color:L.text,marginBottom:20 }}>📚 Academic History</div>
            <StudentHistory student={student} data={data} />
          </>
        )}

        {/* ── PROFILE ── */}
        {tab==='profile' && (
          <div style={{ background:L.card, border:`1.5px solid ${L.border}`, borderRadius:16, padding:24, boxShadow:'0 2px 8px #0000000a' }}>
            <div style={{ display:'flex', alignItems:'center', gap:18, marginBottom:24, flexWrap:'wrap' }}>
              <div style={{ width:64,height:64,borderRadius:18,background:L.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,fontWeight:900,color:'#fff',flexShrink:0 }}>
                {(student.firstName||student.name||'?')[0].toUpperCase()}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:19,fontWeight:900,color:L.text }}>{student.name}</div>
                <div style={{ fontSize:13,color:L.sub }}>{student.class}</div>
                <div style={{ fontSize:12,marginTop:4 }}>
                  <span style={{ background:'#dcfce7',color:'#16a34a',padding:'3px 10px',borderRadius:100,fontSize:11,fontWeight:700 }}>
                    Login Code: {student.slc||'—'}
                  </span>
                </div>
              </div>
            </div>
            <div className="sp-profile-grid">
              {[
                ['First Name',    student.firstName],
                ['Last Name',     student.lastName],
                ['Other Name',    student.otherName],
                ['Admission No',  student.admNo||'—'],
                ['Date of Birth', student.dob],
                ['Year Joined',   student.joined],
                ['Parent/Guardian', student.parentName],
                ['Parent Phone',  student.parentPhone],
              ].map(([l,v])=>(
                <div key={l} style={{ padding:'12px 16px',background:L.bg,borderRadius:10,border:`1px solid ${L.border}`,overflow:'hidden' }}>
                  <div style={{ fontSize:11,color:L.sub,marginBottom:3,fontWeight:600 }}>{l}</div>
                  <div style={{ fontSize:14,fontWeight:700,color:L.text,overflowWrap:'break-word' }}>{v||'—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PARENT PORTAL — light theme, rich dashboard
───────────────────────────────────────────────────────────────── */
export function ParentPortal({ parent, data, onLogout }) {
  injectPortalCSS();
  const myChildren = (data.students||[]).filter(s=>
    (s.parentEmail && parent.email && s.parentEmail.toLowerCase()===parent.email.toLowerCase()) ||
    (s.parentPhone  && parent.phone  && s.parentPhone===parent.phone) ||
    (parent.childId && s.id===parent.childId)
  );
  const [selChildId, setSelChildId] = useState(myChildren[0]?.id||null);
  const [tab, setTab] = useState('dashboard');
  const selChild = myChildren.find(s=>s.id===selChildId);

  const exams = selChild ? (data.exams||[]).filter(e=>e.class===selChild.class&&e.results?.[selChild.name]) : [];
  const latestExam    = exams[exams.length-1];
  const latestResults = latestExam?.results?.[selChild?.name]||{};
  const latestScores  = Object.values(latestResults).map(v=>getScore(v)).filter(v=>v!==null);
  const latestMean    = latestScores.length ? Math.round(latestScores.reduce((a,b)=>a+b,0)/latestScores.length) : null;

  // ── Real fee data, computed from feeSchedule + feePayments ──
  const feeSummary   = selChild ? getStudentFeeSummary(selChild, data) : [];
  const currentRow    = feeSummary[0] || null; // most recent term/year with data
  const totalPaidAll  = selChild ? getTotalPaidAllTime(selChild.id, data) : 0;
  const currentBalance = currentRow ? currentRow.balance : null;

  const TABS = [
    { id:'dashboard', label:'🏠 Home' },
    { id:'history',   label:'📚 Results' },
    { id:'fees',      label:'💰 Fees' },
    { id:'profile',   label:'👤 Profile' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:L.bg, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#065f46,#10b981)', boxShadow:'0 4px 20px #10b98130' }}>
        <div className="sp-header-inner">
          <div className="sp-top-row">
            <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
              <div style={{ width:38,height:38,borderRadius:10,background:'#ffffff30',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:18,color:'#fff',flexShrink:0 }}>E</div>
              <div style={{ minWidth:0 }}>
                <div className="sp-school-name" style={{ fontSize:15,fontWeight:800,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{data.schoolName}</div>
                <div style={{ fontSize:11,color:'#a7f3d0' }}>Parent Portal</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13,fontWeight:700,color:'#fff' }}>{parent.name||'Parent'}</div>
                <div style={{ fontSize:11,color:'#a7f3d0' }}>Parent / Guardian</div>
              </div>
              <button onClick={onLogout} style={{ padding:'7px 14px',borderRadius:8,border:'1px solid #ffffff40',background:'transparent',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',flexShrink:0 }}>
                Logout
              </button>
            </div>
          </div>
          {/* Child selector if multiple */}
          {myChildren.length>1 && (
            <div className="sp-child-row">
              {myChildren.map(child=>(
                <button key={child.id} onClick={()=>setSelChildId(child.id)} style={{
                  padding:'6px 16px',borderRadius:8,border:`1px solid ${selChildId===child.id?'#fff':'#ffffff40'}`,
                  background:selChildId===child.id?'#ffffff30':'transparent',color:'#fff',fontSize:12,fontWeight:selChildId===child.id?700:400,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap',
                }}>
                  {child.name} — {child.class}
                </button>
              ))}
            </div>
          )}
          {/* Tabs */}
          <div className="sp-tabs">
            {TABS.map(t=>(
              <button key={t.id} className="sp-tab-btn" onClick={()=>setTab(t.id)} style={{
                padding:'12px 20px',border:'none',background:'transparent',cursor:'pointer',fontSize:13,fontWeight:tab===t.id?800:500,
                color:tab===t.id?'#fff':'#6ee7b7',borderBottom:`3px solid ${tab===t.id?'#fff':'transparent'}`,transition:'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="sp-content">
        {myChildren.length===0 ? (
          <div style={{ background:L.card,border:`1.5px solid ${L.border}`,borderRadius:16,padding:'48px 24px',textAlign:'center' }}>
            <div style={{ fontSize:48,marginBottom:16 }}>🔍</div>
            <div style={{ fontSize:17,fontWeight:800,color:L.text,marginBottom:8 }}>No children found</div>
            <div style={{ fontSize:14,color:L.sub }}>Your login code doesn't match any student records. Please contact the school office.</div>
          </div>
        ) : selChild && (
          <>
            {/* ── DASHBOARD ── */}
            {tab==='dashboard' && (
              <div>
                <div className="sp-banner" style={{ background:'linear-gradient(135deg,#065f46,#10b981)', borderRadius:18, padding:'28px 32px', marginBottom:24, color:'#fff' }}>
                  <div className="sp-welcome-row" style={{ display:'flex', flexWrap:'wrap', gap:16, width:'100%', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div className="sp-banner-title" style={{ fontSize:20,fontWeight:900,marginBottom:4 }}>{selChild.name}</div>
                      <div style={{ fontSize:13,opacity:0.85 }}>{selChild.class} · Enrolled {selChild.joined}</div>
                    </div>
                    {selChild.admNo && (
                      <div className="sp-login-box" style={{ background:'#ffffff20',borderRadius:12,padding:'12px 20px',textAlign:'center' }}>
                        <div style={{ fontSize:11,color:'#a7f3d0',fontWeight:600,marginBottom:2 }}>ADMISSION NO</div>
                        <div style={{ fontSize:16,fontWeight:900 }}>{selChild.admNo}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sp-stat-grid" style={{ marginBottom:24 }}>
                  <StatCard icon="📝" label="Exams Taken" value={exams.length} color={L.primary} />
                  {latestMean!==null && <StatCard icon="📊" label="Latest Mean" value={`${latestMean}%`} color={latestMean>=60?L.accent:latestMean>=40?L.warning:L.danger} />}
                  <StatCard icon="💰" label="Fee Balance" value={currentBalance!==null?`KES ${currentBalance.toLocaleString()}`:'N/A'} color={currentBalance!==null&&currentBalance<=0?L.accent:L.danger} />
                  <StatCard icon="📋" label="Cases" value={selChild.cases?.length||0} color={selChild.cases?.length?L.danger:L.accent} />
                </div>

                {latestExam && (
                  <div style={{ background:L.card,border:`1.5px solid ${L.border}`,borderRadius:16,padding:24,marginBottom:24,boxShadow:'0 2px 8px #0000000a' }}>
                    <div style={{ fontSize:14,fontWeight:800,color:L.text,marginBottom:16 }}>📝 Latest — {latestExam.name}</div>
                    <div style={{ display:'flex',flexWrap:'wrap',gap:10 }}>
                      {Object.entries(latestResults).map(([sub,val])=>{
                        const score=getScore(val);
                        return (
                          <div key={sub} style={{ background:L.bg,border:`1px solid ${L.border}`,borderRadius:10,padding:'12px 16px',textAlign:'center',minWidth:100,flex:'1 1 100px' }}>
                            <div style={{ fontSize:11,color:L.sub,marginBottom:6,fontWeight:600 }}>{sub}</div>
                            <div style={{ fontSize:22,fontWeight:900,color:score!==null?(score>=60?L.accent:score>=40?L.warning:L.danger):L.sub }}>{score!==null?score:'—'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── RESULTS ── */}
            {tab==='history' && (
              <>
                <div style={{ fontSize:20,fontWeight:900,color:L.text,marginBottom:20 }}>📚 {selChild.name}'s Academic History</div>
                <StudentHistory student={selChild} data={data} />
              </>
            )}

            {/* ── FEES ── */}
            {tab==='fees' && (
              <div>
                <div style={{ background:L.card,border:`1.5px solid ${L.border}`,borderRadius:16,padding:24,boxShadow:'0 2px 8px #0000000a',marginBottom:16 }}>
                  <div style={{ fontSize:15,fontWeight:800,color:L.text,marginBottom:18 }}>💰 Fee Account — {selChild.name}</div>
                  {feeSummary.length===0 ? (
                    <div style={{ color:L.sub,fontSize:14 }}>No fee record set for this student yet. Please contact the school office.</div>
                  ) : (
                    <>
                      {/* Lifetime total paid */}
                      <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'14px 18px', marginBottom:18, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                        <span style={{ fontSize:12, color:L.accent, fontWeight:700 }}>Total Paid (All Time)</span>
                        <span style={{ fontSize:18, fontWeight:900, color:L.text }}>KES {totalPaidAll.toLocaleString()}</span>
                      </div>

                      {/* Per-term breakdown */}
                      <div style={{ fontSize:12, fontWeight:700, color:L.sub, textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>Term-by-Term Breakdown</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {feeSummary.map((row,i) => {
                          const pct = row.expected>0 ? Math.min(100, Math.round(row.paid/row.expected*100)) : 0;
                          return (
                            <div key={i} style={{ border:`1.5px solid ${L.border}`, borderRadius:12, padding:'14px 16px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:6 }}>
                                <span style={{ fontSize:13, fontWeight:800, color:L.text }}>Term {row.term} · {row.year}</span>
                                <span style={{
                                  fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:100,
                                  background: row.balance<=0 ? '#dcfce7' : '#fef2f2',
                                  color: row.balance<=0 ? '#16a34a' : L.danger,
                                }}>{row.balance<=0 ? 'Fully Paid' : 'Balance Due'}</span>
                              </div>
                              <div className="sp-fee-grid">
                                <div style={{ background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px',textAlign:'center' }}>
                                  <div style={{ fontSize:9,color:L.accent,fontWeight:700,textTransform:'uppercase',marginBottom:3 }}>Expected</div>
                                  <div style={{ fontSize:16,fontWeight:900,color:L.text }}>KES {row.expected.toLocaleString()}</div>
                                </div>
                                <div style={{ background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'12px',textAlign:'center' }}>
                                  <div style={{ fontSize:9,color:L.primary,fontWeight:700,textTransform:'uppercase',marginBottom:3 }}>Paid</div>
                                  <div style={{ fontSize:16,fontWeight:900,color:L.text }}>KES {row.paid.toLocaleString()}</div>
                                </div>
                                <div style={{ background: row.balance>0 ? '#fef2f2' : '#f0fdf4', border:`1px solid ${row.balance>0?'#fecaca':'#bbf7d0'}`, borderRadius:10, padding:'12px', textAlign:'center' }}>
                                  <div style={{ fontSize:9, color: row.balance>0?L.danger:L.accent, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Balance</div>
                                  <div style={{ fontSize:16,fontWeight:900,color: row.balance>0?L.danger:L.accent }}>KES {Math.abs(row.balance).toLocaleString()}{row.balance<0?' CR':''}</div>
                                </div>
                              </div>
                              <div style={{ background:L.bg,borderRadius:10,padding:'10px 4px',marginTop:10 }}>
                                <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:L.sub,marginBottom:5,padding:'0 4px' }}>
                                  <span>Payment Progress</span><span>{pct}%</span>
                                </div>
                                <div style={{ background:L.border,borderRadius:100,height:8,overflow:'hidden',margin:'0 4px' }}>
                                  <div style={{ width:`${pct}%`,height:'100%',background:pct>=100?L.accent:pct>50?L.warning:L.danger,borderRadius:100,transition:'width 0.5s' }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── PROFILE ── */}
            {tab==='profile' && (
              <div style={{ background:L.card,border:`1.5px solid ${L.border}`,borderRadius:16,padding:24,boxShadow:'0 2px 8px #0000000a' }}>
                <div style={{ fontSize:15,fontWeight:800,color:L.text,marginBottom:18 }}>👤 {selChild.name}</div>
                <div className="sp-profile-grid">
                  {[
                    ['Full Name',    selChild.name],
                    ['Class',        selChild.class],
                    ['Admission No', selChild.admNo||'—'],
                    ['Date of Birth',selChild.dob],
                    ['Year Joined',  selChild.joined],
                    ['Parent Phone', selChild.parentPhone],
                  ].map(([l,v])=>(
                    <div key={l} style={{ padding:'12px 16px',background:L.bg,borderRadius:10,border:`1px solid ${L.border}`,overflow:'hidden' }}>
                      <div style={{ fontSize:11,color:L.sub,marginBottom:3,fontWeight:600 }}>{l}</div>
                      <div style={{ fontSize:14,fontWeight:700,color:L.text,overflowWrap:'break-word' }}>{v||'—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
