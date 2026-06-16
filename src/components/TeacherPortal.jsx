import React, { useState, useMemo } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, GradeBadge, Alert, Icon, Avatar } from './UI';
import { getAllClasses, getGrade, getScore, GRADES_CBC, getSubjectsForClass } from '../data/initialData';

/* ═══════════════════════════════════════════════════════════
   TEACHER PORTAL  —  fully responsive (phone/tablet/desktop)
   Live data: reads from data.teachers on every render
   ═══════════════════════════════════════════════════════════ */
export default function TeacherPortal({ data, setData, user: loginUser, onLogout }) {
  const [page, setPage]       = useState('home');
  const [navOpen, setNavOpen] = useState(false); // mobile hamburger

  /* ── LIVE user profile: always read fresh from data.teachers ── */
  const liveRecord = useMemo(() => {
    return (data.teachers || []).find(t =>
      t.staffId === loginUser.staffId || t.email === loginUser.email
    );
  }, [data.teachers, loginUser.staffId, loginUser.email]);

  const user = useMemo(() => ({
    ...loginUser,
    isClassTeacher:   liveRecord?.isClassTeacher   ?? loginUser.isClassTeacher   ?? false,
    classTeacherOf:   liveRecord?.classTeacherOf   ?? loginUser.classTeacherOf   ?? null,
    teacherSubjects:  liveRecord?.subjects          ?? loginUser.teacherSubjects  ?? [],
    canEnterAllMarks: liveRecord?.canEnterAllMarks  ?? loginUser.canEnterAllMarks ?? false,
    canSeeFees:       liveRecord?.canSeeFees        ?? loginUser.canSeeFees       ?? false,
    dept:             liveRecord?.dept              ?? loginUser.dept              ?? '',
    staffType:        liveRecord?.staffType         ?? loginUser.staffType        ?? 'teaching',
    name:             liveRecord?.name              ?? loginUser.name,
  }), [liveRecord, loginUser]);

  const mySubjects     = user.teacherSubjects || [];
  const myClasses      = [...new Set(mySubjects.flatMap(s => s.classes))];
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;

  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

  const myTimetableToday = useMemo(() => {
    const slots = [];
    const tt = data.timetable || {};
    Object.entries(tt).forEach(([cls, days]) => {
      if (!myClasses.includes(cls) && cls !== myClass) return;
      const daySlots = days[dayName] || {};
      Object.entries(daySlots).forEach(([time, entry]) => {
        if (entry && mySubjects.some(s => s.subject == entry.subject && (s.classes||[]).includes(cls))) {
          slots.push({ time, class: cls, subject: entry.subject });
        }
      });
    });
    return slots.sort((a, b) => a.time.localeCompare(b.time));
  }, [data.timetable, myClasses, myClass, dayName]);

  const myNotifs = (data.notifications || []).filter(n => n.to == user.staffId && !n.read);

  /* ── Pending score-edit approvals this user must act on ──
     Mirrors the same logic used in the admin Notifications page:
     - Principal must approve every pending request
     - Class teacher must approve requests for exams in their own class
  ── */
  const pendingApprovals = (data.editRequests || []).filter(r => {
    if (r.status !== 'pending') return false;
    if (user.role === 'principal' && r.approvals?.principal == null) return true;
    if (isClassTeacher && myClass) {
      const exam = (data.exams || []).find(e => e.id == r.examId);
      if (exam?.class === myClass && r.approvals?.classTeacher == null) return true;
    }
    return false;
  });

  const NAV = [
    { id: 'home',    icon: '🏠', label: 'Home'        },
    { id: 'lessons', icon: '📅', label: 'My Lessons'  },
    { id: 'marks',   icon: '✏️',  label: 'Enter Marks' },
    { id: 'results', icon: '📊', label: 'View Results' },
    ...(isClassTeacher ? [{ id: 'class', icon: '👩‍🏫', label: 'My Class' }] : []),
    ...(pendingApprovals.length > 0 ? [{ id: 'approvals', icon: '✅', label: `Approve Marks (${pendingApprovals.length})` }] : []),
    { id: 'notifs',  icon: '🔔', label: `Notifications${myNotifs.length > 0 ? ` (${myNotifs.length})` : ''}` },
  ];

  function navigate(id) { setPage(id); setNavOpen(false); }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f1117', position: 'relative' }}>
      {/* ── RESPONSIVE STYLES ── */}
      <style>{`
        /* Mobile nav overlay */
        .tp-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:200; }
        .tp-overlay.open { display:block; }
        /* Sidebar */
        .tp-sidebar { width:220px; background:#171b26; border-right:1px solid #2a3350; display:flex; flex-direction:column; flex-shrink:0; z-index:201; }
        /* Hamburger */
        .tp-hamburger { display:none; position:fixed; top:0; left:0; right:0; z-index:300; background:#171b26; border-bottom:1px solid #2a3350; padding:10px 14px; align-items:center; gap:12px; }
        .tp-main { flex:1; overflow:auto; padding:24px; }
        /* Score input on mobile — big touch target */
        .score-input { width:72px; text-align:center; padding:6px 8px; font-size:14px; font-weight:700; }
        /* Mobile: stack marks table as cards */
        .marks-table { width:100%; border-collapse:collapse; }
        .marks-table thead { display:table-header-group; }
        .marks-table tbody tr { display:table-row; }
        @media (max-width: 700px) {
          .tp-sidebar { position:fixed; top:0; left:0; height:100vh; transform:translateX(-100%); transition:transform 0.25s; }
          .tp-sidebar.open { transform:translateX(0); }
          .tp-hamburger { display:flex; }
          .tp-main { padding:60px 12px 80px; }
          /* marks table → card list on phones */
          .marks-table, .marks-table thead, .marks-table tbody, .marks-table th, .marks-table td, .marks-table tr { display:block; }
          .marks-table thead { display:none; }
          .marks-table tbody tr { margin-bottom:10px; background:#1e2435; border-radius:10px; border:1px solid #2a3350; padding:10px 12px; }
          .marks-table td { padding:3px 0; border:none; display:flex; align-items:center; justify-content:space-between; }
          .marks-table td::before { content:attr(data-label); font-size:10px; color:#64748b; text-transform:uppercase; font-weight:600; }
          .score-input { width:90px; padding:8px; font-size:16px; }
          .tp-page-title { font-size:17px !important; }
          .tp-stat-grid { grid-template-columns: repeat(2,1fr) !important; }
          .tp-btn-row { flex-wrap:wrap !important; }
          .tp-select-row { flex-direction:column !important; }
          .tp-pick-row { flex-direction:column !important; }
          .tp-student-row { flex-wrap:wrap; }
        }
        @media (max-width: 400px) {
          .tp-stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        /* Bottom nav bar on phones */
        .tp-bottom-nav { display:none; }
        @media (max-width:700px) {
          .tp-bottom-nav { display:flex; position:fixed; bottom:0; left:0; right:0; background:#171b26; border-top:1px solid #2a3350; z-index:250; }
          .tp-bottom-nav button { flex:1; padding:8px 4px 10px; background:none; border:none; color:#64748b; font-size:10px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; }
          .tp-bottom-nav button.active { color:#4f8ef7; }
          .tp-bottom-nav button span.ico { font-size:20px; }
        }
      `}</style>

      {/* Mobile overlay */}
      <div className={`tp-overlay ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen(false)} />

      {/* Mobile top bar */}
      <div className="tp-hamburger">
        <button onClick={() => setNavOpen(v => !v)} style={{ background: 'none', border: 'none', color: '#e2e8f0', fontSize: 22, cursor: 'pointer', padding: 2 }}>☰</button>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{NAV.find(n => n.id === page)?.icon} {NAV.find(n => n.id === page)?.label}</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>{data.schoolName}</div>
      </div>

      {/* Sidebar */}
      <aside className={`tp-sidebar ${navOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #2a3350' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={user.name} size={40} color="#4f8ef7" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: '#4f8ef7' }}>{user.staffId}</div>
              {isClassTeacher && <div style={{ fontSize: 10, color: '#10b981', marginTop: 2 }}>Class Teacher · {myClass}</div>}
              {!isClassTeacher && user.canEnterAllMarks && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>Secretary · All Access</div>}
              {!isClassTeacher && !user.canEnterAllMarks && user.staffType === 'teaching' && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Subject Teacher</div>}
              {pendingApprovals.length > 0 && (
                <div onClick={() => navigate('approvals')} style={{ fontSize: 10, color: '#fff', background: '#ef4444', borderRadius: 6, padding: '2px 6px', marginTop: 4, display: 'inline-block', cursor: 'pointer', fontWeight: 700 }}>
                  ✅ {pendingApprovals.length} mark{pendingApprovals.length > 1 ? 's' : ''} to approve
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => navigate(n.id)} style={{
              width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 4,
              background: page === n.id ? '#4f8ef720' : 'transparent',
              color: page === n.id ? '#4f8ef7' : '#94a3b8',
              fontSize: 14, fontWeight: page === n.id ? 600 : 400,
            }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span> {n.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2a3350' }}>
          <button onClick={() => onLogout && onLogout()} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ef444430', background: '#ef444410', color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            ⏻ Logout
          </button>
          <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 6 }}>EduManage Pro · {data.schoolName}</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="tp-main">
        {page === 'home'      && <TeacherHome user={user} data={data} timetableToday={myTimetableToday} myNotifs={myNotifs} pendingApprovals={pendingApprovals} setPage={navigate} />}
        {page === 'lessons'   && <TeacherLessons user={user} data={data} />}
        {page === 'marks'     && <TeacherMarks user={user} data={data} setData={setData} />}
        {page === 'results'   && <TeacherResults user={user} data={data} />}
        {page === 'class'     && isClassTeacher && <TeacherClass user={user} data={data} setData={setData} />}
        {page === 'approvals' && <TeacherApprovals user={user} data={data} setData={setData} />}
        {page === 'notifs'    && <TeacherNotifs user={user} data={data} setData={setData} />}
      </main>

      {/* Bottom nav (phones only) */}
      <nav className="tp-bottom-nav">
        {(() => {
          // Always show Home + Approve Marks (if any) + up to 3 more, max 5 total
          const priority = NAV.filter(n => n.id === 'home' || n.id === 'approvals');
          const rest = NAV.filter(n => n.id !== 'home' && n.id !== 'approvals');
          const bottomItems = [...priority, ...rest].slice(0, 5);
          return bottomItems.map(n => (
            <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => navigate(n.id)}>
              <span className="ico">{n.icon}</span>
              <span>{n.label.replace(/ \(\d+\)/, '')}</span>
            </button>
          ));
        })()}
      </nav>
    </div>
  );
}

/* ══════════════════ HOME DASHBOARD ══════════════════ */
function TeacherHome({ user, data, timetableToday, myNotifs, pendingApprovals = [], setPage }) {
  const mySubjects     = user.teacherSubjects || [];
  const myClasses      = [...new Set(mySubjects.flatMap(s => s.classes))];
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;
  const myStudents     = isClassTeacher ? (data.students || []).filter(s => s.class === myClass) : [];
  const today          = new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hour           = new Date().getHours();
  const greeting       = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  const stats = [
    { label: isClassTeacher ? 'My Students' : 'Classes I Teach', value: isClassTeacher ? myStudents.length : myClasses.length, color: '#4f8ef7', icon: isClassTeacher ? '👨‍🎓' : '🏫', page: isClassTeacher ? 'class' : null },
    { label: 'Subjects', value: mySubjects.length, color: '#10b981', icon: '📚', page: 'marks' },
    { label: "Today's Lessons", value: timetableToday.length, color: '#f59e0b', icon: '📅', page: 'lessons' },
    { label: 'Notifications', value: myNotifs.length, color: myNotifs.length > 0 ? '#ef4444' : '#64748b', icon: '🔔', page: 'notifs' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="tp-page-title" style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>Good {greeting}, {(user.name||'').split(' ')[0]} 👋</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{today}</div>
        {isClassTeacher && <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>Class Teacher · {myClass}</div>}
        {user.canEnterAllMarks && !isClassTeacher && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>You have access to enter marks for all classes and subjects.</div>}
      </div>

      {pendingApprovals.length > 0 && (
        <Alert type="warning" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => setPage('approvals')}>
          <Icon name="alert" size={14} />
          <span>You have <strong>{pendingApprovals.length} score edit request{pendingApprovals.length > 1 ? 's' : ''}</strong> awaiting your approval. <strong style={{ textDecoration: 'underline' }}>Tap to review →</strong></span>
        </Alert>
      )}

      <div className="tp-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} onClick={() => s.page && setPage(s.page)} style={{ background: '#171b26', border: `1px solid ${s.color}30`, borderRadius: 12, padding: '14px 16px', cursor: s.page ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 26 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Card style={{ marginBottom: 14 }}>
        <SectionTitle icon="star">Quick Actions</SectionTitle>
        <div className="tp-btn-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Btn onClick={() => setPage('marks')} variant="ghost">✏️ Enter Marks</Btn>
          <Btn onClick={() => setPage('results')} variant="ghost">📊 View Results</Btn>
          {isClassTeacher && <Btn onClick={() => setPage('class')} variant="ghost">👩‍🏫 My Class</Btn>}
          <Btn onClick={() => setPage('lessons')} variant="ghost">📅 Timetable</Btn>
          <Btn onClick={() => setPage('notifs')} variant="ghost">🔔 Notifications {myNotifs.length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, marginLeft: 4 }}>{myNotifs.length}</span>}</Btn>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <SectionTitle icon="clock">Today's Lessons</SectionTitle>
        {timetableToday.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>No lessons today or timetable not set up yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {timetableToday.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#1e2435', borderRadius: 8, border: '1px solid #2a3350', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4f8ef7', minWidth: 60 }}>{l.time}</div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{l.subject}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{l.class}</div>
                </div>
                <Tag color="blue">{l.class}</Tag>
              </div>
            ))}
          </div>
        )}
      </Card>

      {mySubjects.length > 0 && (
        <Card>
          <SectionTitle icon="book">My Subject Assignments</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mySubjects.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#1e2435', borderRadius: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', flex: 1, minWidth: 120 }}>{s.subject}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(s.classes||[]).map(c => <Tag key={c} color="blue">{c}</Tag>)}
                </div>
                <Btn size="sm" variant="ghost" onClick={() => setPage('marks')}>Enter Marks</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════ MY LESSONS ══════════════════ */
function TeacherLessons({ user, data }) {
  const mySubjects = user.teacherSubjects || [];
  const myClasses  = [...new Set(mySubjects.flatMap(s => s.classes))];
  if (user.isClassTeacher && user.classTeacherOf) myClasses.push(user.classTeacherOf);
  const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
  const tt   = data.timetable || {};

  // Collect all my slots
  const mySlots = [];
  DAYS.forEach(day => {
    Object.entries(tt).forEach(([cls, days]) => {
      if (!myClasses.includes(cls)) return;
      const daySlots = days[day] || {};
      Object.entries(daySlots).forEach(([time, entry]) => {
        if (entry && mySubjects.some(s => s.subject === entry.subject && (s.classes||[]).includes(cls))) {
          mySlots.push({ day, time, class: cls, subject: entry.subject });
        }
      });
    });
  });

  const byDay = DAYS.map(d => ({ day: d, slots: mySlots.filter(s => s.day === d).sort((a, b) => a.time.localeCompare(b.time)) }));

  return (
    <div>
      <div className="tp-page-title" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>📅 My Lessons / Timetable</div>
      {mySlots.length === 0 ? (
        <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No timetable entries yet. Contact your administrator.</div></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {byDay.filter(d => d.slots.length > 0).map(({ day, slots }) => (
            <Card key={day}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4f8ef7', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{day}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {slots.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 10px', background: '#1e2435', borderRadius: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', minWidth: 60 }}>{s.time}</div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', flex: 1 }}>{s.subject}</div>
                    <Tag color="blue">{s.class}</Tag>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════ ENTER MARKS ══════════════════ */
function TeacherMarks({ user, data, setData }) {
  const mySubjects     = user.teacherSubjects || [];
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;
  const canEnterAll    = user.canEnterAllMarks || false;
  const isPrincipal    = user.role === 'principal';

  const myTeachingClasses = [...new Set(mySubjects.flatMap(s => s.classes))];
  const allClasses        = getAllClasses(data);

  const availableClasses = canEnterAll
    ? allClasses
    : [...new Set([...myTeachingClasses, ...(isClassTeacher && myClass ? [myClass] : [])])];

  const [selClass,   setSelClass]   = useState(availableClasses[0] || '');
  const [selExamId,  setSelExamId]  = useState('');
  const [selSubject, setSelSubject] = useState('');
  const [scores,     setScores]     = useState({});
  const [original,   setOriginal]   = useState({}); // scores as they were when loaded (to detect edits)
  const [saved,      setSaved]      = useState(false);
  const [pendingNote, setPendingNote] = useState(''); // feedback after save

  function getClassSubjects(cls) {
    if (!cls) return [];
    if (canEnterAll || (isClassTeacher && cls === myClass)) return getSubjectsForClass(cls, data);
    return mySubjects.filter(s => (s.classes||[]).includes(cls)).map(s => s.subject);
  }

  const classSubjects = getClassSubjects(selClass);
  const classExams    = (data.exams || []).filter(e => e.class === selClass);
  const selExam       = classExams.find(e => String(e.id) === String(selExamId));
  const classStudents = selExam ? (data.students || []).filter(s => s.class === selClass) : [];

  function changeClass(cls) { setSelClass(cls); setSelExamId(''); setSelSubject(''); setScores({}); setOriginal({}); setSaved(false); setPendingNote(''); }
  function changeSubject(sub) {
    setSelSubject(sub); setScores({}); setOriginal({}); setSaved(false); setPendingNote('');
    if (selExam) loadScores(selExam, sub);
  }
  function changeExam(examId) {
    setSelExamId(examId); setScores({}); setOriginal({}); setSaved(false); setPendingNote('');
    const exam = classExams.find(e => String(e.id) === examId);
    if (exam && selSubject) loadScores(exam, selSubject);
  }
  function loadScores(exam, subject) {
    const init = {};
    (data.students || []).filter(s => s.class === exam.class).forEach(st => {
      const cell = exam.results?.[st.name]?.[subject] ?? exam.results?.[st.id]?.[subject];
      init[st.name] = getScore(cell) ?? '';
    });
    setScores(init);
    setOriginal(init); // snapshot — used to detect which scores already existed
    setSaved(false);
    setPendingNote('');
  }

  /* ── Does this user get to apply edits immediately, bypassing approval? ──
     Principal: always. Class teacher: only for their own class. Anyone
     entering a brand-new score (no prior value) never needs approval —
     only CHANGING an already-submitted score does. ── */
  function autoApproved() {
    return isPrincipal || (isClassTeacher && myClass === selClass);
  }

  function getClassTeacherStaffId() {
    const ct = (data.teachers || []).find(t => t.isClassTeacher && t.classTeacherOf === selClass);
    return ct?.staffId || null;
  }

  function saveMarks() {
    if (!selExam || !selSubject) return;

    const ctStaffId = getClassTeacherStaffId();
    const bypass = autoApproved();
    const newEditRequests = [];
    const newNotifications = [];
    let editedCount = 0;

    setData(d => {
      const exams = d.exams.map(ex => {
        if (ex.id !== selExam.id) return ex;
        const res = { ...ex.results };
        classStudents.forEach(st => {
          const raw = scores[st.name];
          if (raw === '' || raw === undefined) return;
          const v = Number(raw);
          if (isNaN(v)) return;

          const hadPrior = original[st.name] !== '' && original[st.name] !== undefined && original[st.name] !== null;
          const isChange = hadPrior && Number(original[st.name]) !== v;

          if (!hadPrior) {
            // First-time entry — always saved directly, no approval needed
            if (!res[st.name]) res[st.name] = {};
            res[st.name][selSubject] = { score: v, submittedBy: user.staffId, locked: false };
          } else if (isChange) {
            editedCount++;
            if (bypass) {
              // Principal or this class's own class teacher — apply immediately
              if (!res[st.name]) res[st.name] = {};
              res[st.name][selSubject] = { ...res[st.name][selSubject], score: v };
            } else {
              // Needs approval — queue an edit request, leave the score untouched for now
              const req = {
                id: Date.now() + Math.floor(Math.random() * 10000),
                examId: selExam.id,
                studentName: st.name,
                subject: selSubject,
                oldScore: Number(original[st.name]),
                newScore: v,
                requestedBy: user.staffId,
                requestedByName: user.name,
                approvals: { classTeacher: null, principal: null },
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
              };
              newEditRequests.push(req);
              if (ctStaffId && ctStaffId !== user.staffId) {
                newNotifications.push({ id: Date.now() + Math.floor(Math.random()*10000), to: ctStaffId, from: user.name, message: `Edit request: ${st.name} — ${selSubject} (${req.oldScore}→${v}). Requested by ${user.name}. Your approval needed.`, date: req.date, read: false });
              }
              const principalId = (d.teachers || []).find(t => t.admin)?.staffId;
              if (principalId) {
                newNotifications.push({ id: Date.now() + Math.floor(Math.random()*10000), to: principalId, from: user.name, message: `Edit request: ${st.name} — ${selSubject} (${req.oldScore}→${v}). Requested by ${user.name}. Your approval needed.`, date: req.date, read: false });
              }
            }
          }
        });
        return { ...ex, results: res };
      });

      return {
        ...d,
        exams,
        editRequests: [...(d.editRequests || []), ...newEditRequests],
        notifications: [...(d.notifications || []), ...newNotifications],
      };
    });

    setSaved(true);
    if (!bypass && editedCount > 0) {
      setPendingNote(`${editedCount} changed score${editedCount>1?'s':''} sent for approval (class teacher + principal). New entries were saved directly.`);
      // Revert on-screen values for queued (not-yet-applied) edits back to their original score
      setScores(prev => {
        const reverted = { ...prev };
        classStudents.forEach(st => {
          const raw = prev[st.name];
          if (raw === '' || raw === undefined) return;
          const v = Number(raw);
          if (isNaN(v)) return;
          const hadPrior = original[st.name] !== '' && original[st.name] !== undefined && original[st.name] !== null;
          const isChange = hadPrior && Number(original[st.name]) !== v;
          if (isChange) reverted[st.name] = original[st.name];
        });
        return reverted;
      });
    } else {
      setPendingNote('');
      // New/auto-approved entries become the new "original" baseline
      setOriginal(scores);
    }
  }

  if (availableClasses.length === 0) {
    return <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No classes assigned. Contact your administrator.</div></Card>;
  }

  /* Step indicators */
  const step1done = !!selClass;
  const step2done = !!selSubject;
  const step3done = !!selExamId;

  return (
    <div>
      <div className="tp-page-title" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>✏️ Enter Marks</div>

      {/* STEP 1 – Class */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Step 1 — Select Class</div>
        <div className="tp-pick-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {availableClasses.map(cls => (
            <button key={cls} onClick={() => changeClass(cls)} style={{
              padding: '10px 18px', borderRadius: 8, border: `2px solid ${selClass === cls ? '#4f8ef7' : '#2a3350'}`,
              background: selClass === cls ? '#4f8ef720' : '#1e2435', color: selClass === cls ? '#4f8ef7' : '#94a3b8',
              cursor: 'pointer', fontSize: 14, fontWeight: selClass === cls ? 700 : 400,
              minHeight: 44, /* touch target */
            }}>{cls}</button>
          ))}
        </div>
      </Card>

      {/* STEP 2 – Subject */}
      {step1done && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Step 2 — Select Subject</div>
          {classSubjects.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>No subjects found for {selClass}. Contact your administrator.</div>
          ) : (
            <div className="tp-pick-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {classSubjects.map(sub => (
                <button key={sub} onClick={() => changeSubject(sub)} style={{
                  padding: '10px 16px', borderRadius: 8, border: `2px solid ${selSubject === sub ? '#10b981' : '#2a3350'}`,
                  background: selSubject === sub ? '#10b98120' : '#1e2435', color: selSubject === sub ? '#10b981' : '#94a3b8',
                  cursor: 'pointer', fontSize: 13, fontWeight: selSubject === sub ? 700 : 400,
                  minHeight: 44,
                }}>{sub}</button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* STEP 3 – Exam */}
      {step1done && step2done && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Step 3 — Select Exam</div>
          {classExams.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>No exams created yet for {selClass}. Ask the administrator to create exams first.</div>
          ) : (
            <div className="tp-pick-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {classExams.map(e => (
                <button key={e.id} onClick={() => changeExam(String(e.id))} style={{
                  padding: '10px 16px', borderRadius: 8, border: `2px solid ${selExamId === String(e.id) ? '#7c3aed' : '#2a3350'}`,
                  background: selExamId === String(e.id) ? '#7c3aed20' : '#1e2435',
                  color: selExamId === String(e.id) ? '#a78bfa' : '#94a3b8',
                  cursor: 'pointer', fontSize: 13, fontWeight: selExamId === String(e.id) ? 700 : 400,
                  minHeight: 44, textAlign: 'left',
                }}>
                  <div>{e.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Term {e.term} · {e.year}</div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* SCORE TABLE */}
      {selExam && selSubject && classStudents.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{selSubject} — {selClass}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{selExam.name} · Term {selExam.term} · {selExam.year}</div>
            </div>
            <Btn variant="success" onClick={saveMarks} style={{ minHeight: 44, fontSize: 15 }}>{saved ? '✅ Saved!' : '💾 Save Marks'}</Btn>
          </div>

          {!autoApproved() && (
            <Alert type="info" style={{ marginBottom: 14 }}>
              <Icon name="alert" size={14} />
              <span>New scores save instantly. Changing a score that's already submitted will be sent to the class teacher and principal for approval.</span>
            </Alert>
          )}
          {saved && pendingNote && (
            <Alert type="warning" style={{ marginBottom: 14 }}>
              <Icon name="alert" size={14} /> <span>{pendingNote}</span>
            </Alert>
          )}

          {/* Desktop: table | Mobile: card list (via CSS) */}
          <table className="marks-table">
            <thead>
              <tr style={{ background: '#1e2435', borderBottom: '2px solid #2a3350' }}>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>#</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Student</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Adm No</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', color: '#4f8ef7', fontSize: 11, fontWeight: 700 }}>Score (0–100)</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map((st, i) => {
                const score    = scores[st.name];
                const numScore = score !== '' && score !== undefined && !isNaN(Number(score)) ? Number(score) : null;
                const hadPrior = original[st.name] !== '' && original[st.name] !== undefined && original[st.name] !== null;
                const isChanged = hadPrior && numScore !== null && Number(original[st.name]) !== numScore;
                const needsApproval = isChanged && !autoApproved();
                return (
                  <tr key={st.id} style={{ borderBottom: '1px solid #2a3350' }}>
                    <td data-label="#" style={{ padding: '8px 10px', color: '#64748b' }}>{i + 1}</td>
                    <td data-label="Student" style={{ padding: '8px 10px', fontWeight: 600, color: '#e2e8f0' }}>{st.name}</td>
                    <td data-label="Adm No" style={{ padding: '8px 10px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{st.admNo}</td>
                    <td data-label="Score" style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <input
                        type="number" min={0} max={100}
                        value={score ?? ''}
                        inputMode="numeric"
                        onChange={e => { setScores(p => ({ ...p, [st.name]: e.target.value })); setSaved(false); }}
                        className="score-input"
                        style={{ width: 80, textAlign: 'center', padding: '8px', fontSize: 16, fontWeight: 700, borderRadius: 8, background: '#0f1117', border: `2px solid ${needsApproval ? '#f59e0b' : '#2a3350'}`, color: '#e2e8f0' }}
                      />
                      {needsApproval && <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 3 }}>needs approval</div>}
                    </td>
                    <td data-label="Grade" style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {numScore !== null ? <GradeBadge score={numScore} /> : <span style={{ color: '#2a3350' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn variant="success" onClick={saveMarks} style={{ minHeight: 48, fontSize: 16, padding: '12px 28px' }}>{saved ? '✅ Saved!' : '💾 Save Marks'}</Btn>
          </div>
        </Card>
      )}

      {step1done && step2done && step3done && classStudents.length === 0 && (
        <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No students in {selClass} yet.</div></Card>
      )}
    </div>
  );
}

/* ══════════════════ VIEW RESULTS ══════════════════ */
function TeacherResults({ user, data }) {
  const mySubjects     = user.teacherSubjects || [];
  const mySubjectNames = mySubjects.map(s => s.subject);
  const canSeeAll      = user.isClassTeacher || user.canEnterAllMarks;

  const myTeachingClasses = [...new Set(mySubjects.flatMap(s => s.classes))];
  const allClasses        = getAllClasses(data);
  const availableClasses  = user.canEnterAllMarks
    ? allClasses
    : [...new Set([...myTeachingClasses, ...(user.isClassTeacher && user.classTeacherOf ? [user.classTeacherOf] : [])])];

  const [selClass,  setSelClass]  = useState(availableClasses[0] || '');
  const [selExamId, setSelExamId] = useState('');

  const classExams = (data.exams || []).filter(e => e.class === selClass);
  const selExam    = classExams.find(e => String(e.id) === String(selExamId));
  const students   = (data.students || []).filter(s => s.class === selClass);

  const visibleSubjects = selExam
    ? [...new Set(Object.values(selExam.results || {}).flatMap(r => Object.keys(r)))]
        .filter(sub => canSeeAll ? true : mySubjectNames.includes(sub))
    : [];

  return (
    <div>
      <div className="tp-page-title" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>📊 View Results</div>

      <div className="tp-select-row" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selClass} onChange={e => { setSelClass(e.target.value); setSelExamId(''); }} style={{ minWidth: 140, padding: '10px 12px', fontSize: 14, borderRadius: 8, minHeight: 44 }}>
          <option value="">— Select class —</option>
          {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {selClass && (
          <select value={selExamId} onChange={e => setSelExamId(e.target.value)} style={{ minWidth: 200, padding: '10px 12px', fontSize: 14, borderRadius: 8, minHeight: 44 }}>
            <option value="">— Select exam —</option>
            {classExams.map(e => <option key={e.id} value={e.id}>{e.name} (Term {e.term})</option>)}
          </select>
        )}
      </div>

      {!canSeeAll && mySubjectNames.length > 0 && (
        <Alert type="info" style={{ marginBottom: 12 }}><Icon name="alert" size={14} /> Showing only your subjects: <strong>{mySubjectNames.join(', ')}</strong></Alert>
      )}

      {selExam ? (
        visibleSubjects.length === 0 ? (
          <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No marks entered yet for this exam.</div></Card>
        ) : (
          <Card noPad style={{ overflowX: 'auto' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a3350', fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>
              {selExam.name} — {selClass} · Term {selExam.term} · {selExam.year}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 400 }}>
                <thead>
                  <tr style={{ background: '#1e2435' }}>
                    <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>#</th>
                    <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Name</th>
                    {visibleSubjects.map(s => <th key={s} style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{s}</th>)}
                    {canSeeAll && <th style={{ padding: '10px 10px', textAlign: 'center', color: '#10b981', fontSize: 11, fontWeight: 700 }}>Total</th>}
                  </tr>
                </thead>
                <tbody>
                  {students.map((st, idx) => {
                    const scores = visibleSubjects.map(sub => getScore(selExam.results?.[st.name]?.[sub]));
                    const total  = scores.reduce((a, v) => a + (v ?? 0), 0);
                    return (
                      <tr key={st.id} style={{ borderBottom: '1px solid #2a3350' }}>
                        <td style={{ padding: '9px 10px', color: '#64748b', fontSize: 11 }}>{idx + 1}</td>
                        <td style={{ padding: '9px 10px', fontWeight: 500, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{st.name}</td>
                        {scores.map((score, si) => (
                          <td key={si} style={{ padding: '9px 8px', textAlign: 'center' }}>
                            {score !== null ? <span style={{ fontWeight: 700, color: score >= 60 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444' }}>{score}</span> : <span style={{ color: '#2a3350' }}>—</span>}
                          </td>
                        ))}
                        {canSeeAll && <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: '#4f8ef7' }}>{total}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>Select a class and exam to view results.</div></Card>
      )}
    </div>
  );
}

/* ══════════════════ MY CLASS ══════════════════ */
function TeacherClass({ user, data, setData }) {
  const myStudents  = (data.students || []).filter(s => s.class === user.classTeacherOf);
  const [showModal, setShowModal] = useState(false);
  const [editSt,    setEditSt]    = useState(null);
  const [form,      setForm]      = useState({});
  const [search,    setSearch]    = useState('');

  const BLANK = { name: '', admNo: '', gender: 'Male', dob: '', parentName: '', parentPhone: '', status: 'active' };

  function openAdd()   { setEditSt(null); setForm({ ...BLANK, class: user.classTeacherOf }); setShowModal(true); }
  function openEdit(s) { setEditSt(s);    setForm({ ...s });                                   setShowModal(true); }

  function save() {
    if (!form.name?.trim()) { alert('Student name is required.'); return; }
    if (editSt) {
      setData(d => ({ ...d, students: d.students.map(s => s.id === editSt.id ? { ...s, ...form } : s) }));
    } else {
      setData(d => ({ ...d, students: [...d.students, { id: Date.now(), ...form, class: user.classTeacherOf }] }));
    }
    setShowModal(false);
  }

  const filtered = myStudents.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.admNo||'').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div className="tp-page-title" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>👩‍🏫 My Class — {user.classTeacherOf}</div>
        <Btn onClick={openAdd} style={{ minHeight: 44 }}>+ Add Student</Btn>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <SectionTitle icon="students">{myStudents.length} Students</SectionTitle>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, minWidth: 0, width: 180 }} />
        </div>
        {filtered.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>{search ? 'No match.' : 'No students yet. Click "+ Add Student".'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((st, i) => (
              <div key={st.id} className="tp-student-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#1e2435', borderRadius: 8, border: '1px solid #2a3350' }}>
                <div style={{ fontSize: 12, color: '#64748b', minWidth: 22, textAlign: 'right' }}>{i + 1}</div>
                <Avatar name={st.name} size={32} color="#4f8ef7" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Adm: {st.admNo} · {st.gender}{st.parentPhone && ` · 📱 ${st.parentPhone}`}</div>
                </div>
                <Tag color={!st.status || st.status === 'active' ? 'green' : 'red'}>{st.status || 'active'}</Tag>
                <Btn size="sm" variant="ghost" onClick={() => openEdit(st)} style={{ minWidth: 36, minHeight: 36 }}>✏️</Btn>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editSt ? `Edit: ${editSt.name}` : 'Add New Student'}>
        <FormRow>
          <FormGroup label="Full Name *"><input value={form.name||''} onChange={e => setForm({...form,name:e.target.value})} placeholder="John Kamau Mwangi" autoFocus /></FormGroup>
          <FormGroup label="Admission No"><input value={form.admNo||''} onChange={e => setForm({...form,admNo:e.target.value})} placeholder="KCS/001/2026" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Gender">
            <select value={form.gender||'Male'} onChange={e => setForm({...form,gender:e.target.value})}>
              <option>Male</option><option>Female</option>
            </select>
          </FormGroup>
          <FormGroup label="Date of Birth"><input type="date" value={form.dob||''} onChange={e => setForm({...form,dob:e.target.value})} /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Parent / Guardian Name"><input value={form.parentName||''} onChange={e => setForm({...form,parentName:e.target.value})} placeholder="Mary Kamau" /></FormGroup>
          <FormGroup label="Parent Phone"><input value={form.parentPhone||''} onChange={e => setForm({...form,parentPhone:e.target.value})} placeholder="0712345678" /></FormGroup>
        </FormRow>
        <FormGroup label="Status">
          <select value={form.status||'active'} onChange={e => setForm({...form,status:e.target.value})}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="transferred">Transferred</option>
            <option value="completed">Completed</option>
          </select>
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
          <Btn onClick={save}>{editSt ? '✅ Save Changes' : '+ Add Student'}</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════ APPROVE MARK EDITS ══════════════════
   Mirrors the approval logic used in the admin Notifications page:
   - Class teacher approves requests for exams in their own class
   - Principal approves everything (handled in admin portal, but this
     component works for any role that has a pending approval, in case
     a principal ever logs in through this portal too)
═══════════════════════════════════════════════════════ */
function TeacherApprovals({ user, data, setData }) {
  const isClassTeacher = user.isClassTeacher;
  const myClass         = user.classTeacherOf;

  const pending = (data.editRequests || []).filter(r => {
    if (r.status !== 'pending') return false;
    if (user.role === 'principal' && r.approvals?.principal == null) return true;
    if (isClassTeacher && myClass) {
      const exam = (data.exams || []).find(e => e.id == r.examId);
      if (exam?.class === myClass && r.approvals?.classTeacher == null) return true;
    }
    return false;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const history = (data.editRequests || []).filter(r => {
    if (r.status === 'pending') return false;
    // Show requests this user was involved in approving, or for their class
    if (user.role === 'principal') return true;
    if (isClassTeacher && myClass) {
      const exam = (data.exams || []).find(e => e.id == r.examId);
      return exam?.class === myClass;
    }
    return r.requestedBy === user.staffId;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 15);

  function applyEditRequest(d, req) {
    return {
      ...d,
      exams: d.exams.map(ex => {
        if (ex.id !== req.examId) return ex;
        const r = { ...ex.results };
        if (r[req.studentName]?.[req.subject]) {
          r[req.studentName] = { ...r[req.studentName], [req.subject]: { ...r[req.studentName][req.subject], score: req.newScore } };
        }
        return { ...ex, results: r };
      }),
    };
  }

  function handleDecision(reqId, decision) {
    setData(d => {
      const req = (d.editRequests || []).find(r => r.id === reqId);
      if (!req) return d;

      const updated = { ...req, approvals: { ...req.approvals } };
      if (user.role === 'principal') updated.approvals.principal = decision;
      else if (isClassTeacher) updated.approvals.classTeacher = decision;

      const { classTeacher, principal } = updated.approvals;
      let nextData = { ...d, editRequests: d.editRequests.map(r => r.id === reqId ? updated : r) };
      const notifications = [...(nextData.notifications || [])];

      if (classTeacher === 'approved' && principal === 'approved') {
        updated.status = 'approved';
        nextData = applyEditRequest(nextData, updated);
        notifications.push(
          { id: Date.now() + 1, to: req.requestedBy, from: 'System', message: `✅ Your edit request for ${req.studentName} — ${req.subject} (${req.oldScore}→${req.newScore}) has been APPROVED.`, date: new Date().toISOString().split('T')[0], read: false },
        );
      } else if (classTeacher === 'rejected' || principal === 'rejected') {
        updated.status = 'rejected';
        notifications.push(
          { id: Date.now() + 1, to: req.requestedBy, from: 'System', message: `❌ Your edit request for ${req.studentName} — ${req.subject} (${req.oldScore}→${req.newScore}) was REJECTED.`, date: new Date().toISOString().split('T')[0], read: false },
        );
      }

      return { ...nextData, notifications };
    });
  }

  return (
    <div>
      <div className="tp-page-title" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>
        ✅ Approve Mark Edits
      </div>

      {pending.length === 0 ? (
        <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No pending mark edit requests right now.</div></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {pending.map(r => (
            <Card key={r.id} style={{ borderColor: '#f59e0b40', background: '#f59e0b08' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0', marginBottom: 6 }}>{r.studentName}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Subject: <strong style={{ color: '#e2e8f0' }}>{r.subject}</strong></div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
                Score change: <span style={{ color: '#ef4444', fontWeight: 700 }}>{r.oldScore}</span> → <span style={{ color: '#10b981', fontWeight: 700 }}>{r.newScore}</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Requested by {r.requestedByName} · {r.date}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span>Class Teacher: <strong style={{ color: r.approvals?.classTeacher === 'approved' ? '#10b981' : r.approvals?.classTeacher === 'rejected' ? '#ef4444' : '#f59e0b' }}>{r.approvals?.classTeacher || 'Pending'}</strong></span>
                <span>Principal: <strong style={{ color: r.approvals?.principal === 'approved' ? '#10b981' : r.approvals?.principal === 'rejected' ? '#ef4444' : '#f59e0b' }}>{r.approvals?.principal || 'Pending'}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="success" onClick={() => handleDecision(r.id, 'approved')} style={{ minHeight: 42 }}>✓ Approve</Btn>
                <Btn variant="danger" onClick={() => handleDecision(r.id, 'rejected')} style={{ minHeight: 42 }}>✕ Reject</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Recent History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(r => (
              <div key={r.id} style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{r.studentName} — {r.subject}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{r.oldScore} → {r.newScore} · by {r.requestedByName} · {r.date}</div>
                </div>
                <Tag color={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status}</Tag>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TeacherNotifs({ user, data, setData }) {
  function markRead(id)  { setData(d => ({ ...d, notifications: (d.notifications||[]).map(n => n.id === id ? {...n,read:true} : n) })); }
  function markAllRead() { setData(d => ({ ...d, notifications: (d.notifications||[]).map(n => n.to === user.staffId ? {...n,read:true} : n) })); }

  const myNotifs = (data.notifications||[]).filter(n => n.to === user.staffId || n.to === 'ALL').sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const unread   = myNotifs.filter(n => !n.read).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div className="tp-page-title" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>🔔 Notifications {unread > 0 && <span style={{ fontSize: 14, background: '#ef4444', color: '#fff', borderRadius: 20, padding: '2px 8px', marginLeft: 8 }}>{unread}</span>}</div>
        {unread > 0 && <Btn variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Btn>}
      </div>
      {myNotifs.length === 0 ? (
        <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No notifications yet.</div></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myNotifs.map(n => (
            <div key={n.id} style={{ background: '#171b26', border: `1px solid ${n.read ? '#2a3350' : '#4f8ef750'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? '#2a3350' : '#4f8ef7', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: n.read ? '#94a3b8' : '#e2e8f0', lineHeight: 1.5 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>From: {n.from} · {n.date}</div>
              </div>
              {!n.read && <Btn size="sm" variant="ghost" onClick={() => markRead(n.id)} style={{ flexShrink: 0 }}>✓</Btn>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
