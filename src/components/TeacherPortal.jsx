import React, { useState, useMemo } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, GradeBadge, Alert, Icon, Avatar } from './UI';
import { getAllClasses, getGrade, getScore, GRADES_CBC, getSubjectsForClass } from '../data/initialData';

/* ── Teacher Portal — shown when user.role == 'teacher' ── */
export default function TeacherPortal({ data, setData, user, onLogout }) {
  const [page, setPage] = useState('home');

  const mySubjects   = user.teacherSubjects || [];
  const myClasses    = [...new Set(mySubjects.flatMap(s => s.classes))];
  const isClassTeacher = user.isClassTeacher;
  const myClass      = user.classTeacherOf;

  const today = new Date().toISOString().split('T')[0];
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

  // My timetable entries for today
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

  // Pending notifications for me
  const myNotifs = (data.notifications || []).filter(n => n.to == user.staffId && !n.read);

  // My pending edit requests
  const myPendingEdits = (data.editRequests || []).filter(r =>
    r.status == 'pending' && (
      r.requestedBy == user.staffId ||
      (isClassTeacher && r.classApproval == null) ||
      user.admin
    )
  );

  const NAV = [
    { id: 'home',    icon: '🏠', label: 'Home' },
    { id: 'lessons', icon: '📅', label: 'My Lessons' },
    { id: 'marks',   icon: '✏️', label: 'Enter Marks' },
    { id: 'results', icon: '📊', label: 'View Results' },
    ...(isClassTeacher ? [{ id: 'class', icon: '👩‍🏫', label: 'My Class' }] : []),
    { id: 'notifs',  icon: '🔔', label: `Notifications${myNotifs.length > 0 ? ` (${myNotifs.length})` : ''}` },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0f1117' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#171b26', borderRight: '1px solid #2a3350', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #2a3350' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={user.name} size={40} color="#4f8ef7" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: '#4f8ef7' }}>{user.staffId}</div>
              {isClassTeacher && <div style={{ fontSize: 10, color: '#10b981', marginTop: 2 }}>Class Teacher · {myClass}</div>}
              {!isClassTeacher && user.canEnterAllMarks && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>Secretary · All Access</div>}
              {!isClassTeacher && !user.canEnterAllMarks && user.staffType === 'teaching' && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Subject Teacher</div>}
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 8px', flex: 1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 4,
              background: page == n.id ? '#4f8ef720' : 'transparent',
              color: page == n.id ? '#4f8ef7' : '#94a3b8',
              fontSize: 13, fontWeight: page == n.id ? 600 : 400,
            }}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2a3350' }}>
          <button onClick={() => onLogout && onLogout()}
            style={{ width: '100%', padding: '9px 14px', borderRadius: 8, border: '1px solid #ef444430', background: '#ef444410', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = '#ef444420'}
            onMouseLeave={e => e.currentTarget.style.background = '#ef444410'}>
            ⏻ Logout
          </button>
          <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 6 }}>EduManage Pro · {data.schoolName}</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {page == 'home'    && <TeacherHome user={user} data={data} timetableToday={myTimetableToday} myNotifs={myNotifs} setPage={setPage} />}
        {page == 'lessons' && <TeacherLessons user={user} data={data} />}
        {page == 'marks'   && <TeacherMarks user={user} data={data} setData={setData} />}
        {page == 'results' && <TeacherResults user={user} data={data} />}
        {page == 'class'   && isClassTeacher && <TeacherClass user={user} data={data} setData={setData} />}
        {page == 'notifs'  && <TeacherNotifs user={user} data={data} setData={setData} />}
      </main>
    </div>
  );
}

/* ── Home Dashboard ── */
function TeacherHome({ user, data, timetableToday, myNotifs, setPage }) {
  const mySubjects     = user.teacherSubjects || [];
  const myClasses      = [...new Set(mySubjects.flatMap(s => s.classes))];
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;
  const myStudents     = isClassTeacher ? (data.students || []).filter(s => s.class === myClass) : [];
  const today          = new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const totalExams     = (data.exams || []).filter(e => myClasses.includes(e.class) || e.class === myClass).length;

  const stats = [
    { label: isClassTeacher ? 'My Students' : 'Classes I Teach', value: isClassTeacher ? myStudents.length : myClasses.length, color: '#4f8ef7', icon: isClassTeacher ? '👨‍🎓' : '🏫', page: isClassTeacher ? 'class' : null },
    { label: 'Subjects', value: mySubjects.length, color: '#10b981', icon: '📚', page: 'marks' },
    { label: "Today's Lessons", value: timetableToday.length, color: '#f59e0b', icon: '📅', page: 'lessons' },
    { label: 'Notifications', value: myNotifs.length, color: myNotifs.length > 0 ? '#ef4444' : '#64748b', icon: '🔔', page: 'notifs' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {(user.name||"").split(' ')[0]} 👋</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{today}</div>
        {isClassTeacher && <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>Class Teacher · {myClass}</div>}
        {user.canEnterAllMarks && !isClassTeacher && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>You have access to enter marks for all classes and subjects.</div>}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} onClick={() => s.page && setPage(s.page)} style={{ background: '#171b26', border: `1px solid ${s.color}30`, borderRadius: 12, padding: '16px 20px', cursor: s.page ? 'pointer' : 'default', transition: 'border-color 0.2s' }}
            onMouseEnter={e => { if (s.page) e.currentTarget.style.borderColor = s.color; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${s.color}30`; }}>
            <div style={{ fontSize: 28 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle icon="star">Quick Actions</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Btn onClick={() => setPage('marks')} variant="ghost"><Icon name="edit" size={13} /> Enter Marks</Btn>
          <Btn onClick={() => setPage('results')} variant="ghost"><Icon name="chart" size={13} /> View Results</Btn>
          {isClassTeacher && <Btn onClick={() => setPage('class')} variant="ghost">👩‍🏫 My Class</Btn>}
          <Btn onClick={() => setPage('lessons')} variant="ghost"><Icon name="clock" size={13} /> My Timetable</Btn>
          <Btn onClick={() => setPage('notifs')} variant="ghost"><Icon name="bell" size={13} /> Notifications {myNotifs.length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, marginLeft: 4 }}>{myNotifs.length}</span>}</Btn>
        </div>
      </Card>

      {/* Today's timetable */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle icon="clock">Today's Lessons</SectionTitle>
        {timetableToday.length == 0 ? (
          <div style={{ color: '#64748b', fontSize: 13, padding: '16px 0' }}>No lessons scheduled for today or timetable not set up yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {timetableToday.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: '#1e2435', borderRadius: 8, border: '1px solid #2a3350' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4f8ef7', minWidth: 70 }}>{l.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{l.subject}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{l.class}</div>
                </div>
                <Tag color="blue">{l.class}</Tag>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* My subject assignments */}
      {mySubjects.length > 0 && (
        <Card>
          <SectionTitle icon="book">My Subject Assignments</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mySubjects.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#1e2435', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', minWidth: 140 }}>{s.subject}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(s.classes||[]).map(c => <Tag key={c} color="blue">{c}</Tag>)}
                </div>
                <Btn size="sm" variant="ghost" onClick={() => setPage('marks')} style={{ marginLeft: 'auto' }}>Enter Marks</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {mySubjects.length === 0 && !user.canEnterAllMarks && (
        <Card>
          <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>No subjects assigned yet. Contact your administrator to assign you subjects.</div>
        </Card>
      )}
    </div>
  );
}

/* ── Full Weekly Timetable ── */
function TeacherLessons({ user, data }) {
  const mySubjects = user.teacherSubjects || [];
  const myClasses  = [...new Set(mySubjects.flatMap(s => s.classes))];
  if (user.isClassTeacher && user.classTeacherOf) myClasses.push(user.classTeacherOf);
  const uniqueClasses = [...new Set(myClasses)];

  const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
  const tt   = data.timetable || {};

  // Gather all times
  const allTimes = new Set();
  uniqueClasses.forEach(cls => {
    DAYS.forEach(day => {
      Object.keys(tt[cls]?.[day] || {}).forEach(t => allTimes.add(t));
    });
  });
  const times = [...allTimes].sort();

  // Build my lessons matrix: time → day → { class, subject }
  const myLessons = {};
  times.forEach(time => {
    myLessons[time] = {};
    DAYS.forEach(day => {
      uniqueClasses.forEach(cls => {
        const entry = tt[cls]?.[day]?.[time];
        if (entry && mySubjects.some(s => s.subject == entry.subject && (s.classes||[]).includes(cls))) {
          myLessons[time][day] = { class: cls, subject: entry.subject };
        }
      });
    });
  });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>📅 My Weekly Timetable</div>
      {times.length == 0 ? (
        <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>Timetable not set up yet. Ask your administrator.</div></Card>
      ) : (
        <Card noPad>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontSize: 11, fontWeight: 600, textAlign: 'left', background: '#1e2435', borderBottom: '1px solid #2a3350' }}>Time</th>
                  {DAYS.map(d => (
                    <th key={d} style={{ padding: '10px 14px', color: '#64748b', fontSize: 11, fontWeight: 600, textAlign: 'center', background: '#1e2435', borderBottom: '1px solid #2a3350' }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {times.map(time => (
                  <tr key={time} style={{ borderBottom: '1px solid #2a3350' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#4f8ef7', whiteSpace: 'nowrap' }}>{time}</td>
                    {DAYS.map(day => {
                      const entry = myLessons[time][day];
                      return (
                        <td key={day} style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {entry ? (
                            <div style={{ background: '#4f8ef715', border: '1px solid #4f8ef730', borderRadius: 8, padding: '6px 10px' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#4f8ef7' }}>{entry.subject}</div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>{entry.class}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#2a3350', fontSize: 18 }}>·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Enter Marks ── */
function TeacherMarks({ user, data, setData }) {
  const mySubjects     = user.teacherSubjects || [];
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;
  const canEnterAll    = user.canEnterAllMarks || false; // secretary / admin

  // Build list of classes this user can enter marks for
  const myTeachingClasses = [...new Set(mySubjects.flatMap(s => s.classes))];
  const allClasses         = getAllClasses(data);

  // Available classes for marks entry
  const availableClasses = canEnterAll
    ? allClasses
    : [...new Set([
        ...myTeachingClasses,
        ...(isClassTeacher && myClass ? [myClass] : []),
      ])];

  const [selClass, setSelClass]   = useState(availableClasses[0] || '');
  const [selExamId, setSelExamId] = useState('');
  const [selSubject, setSelSubject] = useState('');
  const [scores, setScores]       = useState({});
  const [saved, setSaved]         = useState(false);

  // Subjects available to enter for selected class
  function getAvailableSubjects(cls) {
    if (!cls) return [];
    if (canEnterAll) {
      // Secretary: all subjects in that class
      return getSubjectsForClass(cls, data);
    }
    if (isClassTeacher && cls === myClass) {
      // Class teacher: all subjects for their class
      return getSubjectsForClass(cls, data);
    }
    // Subject teacher: only their assigned subjects for that class
    return mySubjects.filter(s => (s.classes || []).includes(cls)).map(s => s.subject);
  }

  const classSubjects = getAvailableSubjects(selClass);
  const classExams    = (data.exams || []).filter(e => e.class === selClass);
  const selExam       = classExams.find(e => String(e.id) === String(selExamId));
  const classStudents = selExam ? (data.students || []).filter(s => s.class === selClass) : [];

  function handleClassChange(cls) {
    setSelClass(cls);
    setSelExamId('');
    setSelSubject('');
    setScores({});
    setSaved(false);
  }

  function handleExamChange(examId) {
    setSelExamId(examId);
    setScores({});
    setSaved(false);
    const exam = classExams.find(e => String(e.id) === examId);
    if (exam && selSubject) loadScores(exam, selSubject);
  }

  function handleSubjectChange(sub) {
    setSelSubject(sub);
    setScores({});
    setSaved(false);
    if (selExam) loadScores(selExam, sub);
  }

  function loadScores(exam, subject) {
    const init = {};
    (data.students || []).filter(s => s.class === exam.class).forEach(st => {
      const cell       = exam.results?.[st.name]?.[subject];
      const legacyCell = exam.results?.[st.id]?.[subject];
      init[st.name] = getScore(cell) ?? getScore(legacyCell) ?? '';
    });
    setScores(init);
    setSaved(false);
  }

  function saveMarks() {
    if (!selExam || !selSubject) return;
    setData(d => ({
      ...d,
      exams: d.exams.map(ex => {
        if (ex.id !== selExam.id) return ex;
        const newResults = { ...ex.results };
        classStudents.forEach(st => {
          if (!newResults[st.name]) newResults[st.name] = {};
          const v = Number(scores[st.name]);
          if (!isNaN(v) && String(scores[st.name]) !== '') {
            newResults[st.name][selSubject] = { score: v, submittedBy: user.staffId, locked: false };
          }
        });
        return { ...ex, results: newResults };
      }),
    }));
    setSaved(true);
  }

  if (availableClasses.length === 0) {
    return <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No classes assigned. Contact your administrator.</div></Card>;
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>✏️ Enter Marks</div>

      {/* Class picker */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' }}>Select Class</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {availableClasses.map(cls => (
            <button key={cls} onClick={() => handleClassChange(cls)} style={{
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${selClass === cls ? '#4f8ef7' : '#2a3350'}`,
              background: selClass === cls ? '#4f8ef720' : '#1e2435', color: selClass === cls ? '#4f8ef7' : '#94a3b8',
              cursor: 'pointer', fontSize: 13, fontWeight: selClass === cls ? 700 : 400,
            }}>{cls}</button>
          ))}
        </div>
      </Card>

      {/* Subject picker */}
      {selClass && classSubjects.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' }}>Select Subject</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {classSubjects.map(sub => (
              <button key={sub} onClick={() => handleSubjectChange(sub)} style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${selSubject === sub ? '#10b981' : '#2a3350'}`,
                background: selSubject === sub ? '#10b98120' : '#1e2435', color: selSubject === sub ? '#10b981' : '#94a3b8',
                cursor: 'pointer', fontSize: 13, fontWeight: selSubject === sub ? 700 : 400,
              }}>{sub}</button>
            ))}
          </div>
        </Card>
      )}

      {/* Exam picker */}
      {selClass && selSubject && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' }}>Select Exam</div>
          {classExams.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>No exams created yet for {selClass}. Ask the administrator to create exams.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {classExams.map(e => (
                <button key={e.id} onClick={() => handleExamChange(String(e.id))} style={{
                  padding: '8px 16px', borderRadius: 8, border: `1px solid ${selExamId === String(e.id) ? '#7c3aed' : '#2a3350'}`,
                  background: selExamId === String(e.id) ? '#7c3aed20' : '#1e2435',
                  color: selExamId === String(e.id) ? '#a78bfa' : '#94a3b8',
                  cursor: 'pointer', fontSize: 13, fontWeight: selExamId === String(e.id) ? 700 : 400,
                }}>
                  <div>{e.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Term {e.term} · {e.year}</div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Score entry table */}
      {selExam && selSubject && classStudents.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{selSubject} — {selClass}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{selExam.name} · Term {selExam.term} · {selExam.year}</div>
            </div>
            <Btn variant="success" onClick={saveMarks}>{saved ? '✅ Saved!' : '💾 Save Marks'}</Btn>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e2435', borderBottom: '2px solid #2a3350' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Student Name</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Adm No</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', color: '#4f8ef7', fontSize: 11, fontWeight: 700 }}>{selSubject} (0–100)</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((st, i) => {
                  const score    = scores[st.name];
                  const numScore = score !== '' && !isNaN(Number(score)) ? Number(score) : null;
                  return (
                    <tr key={st.id} style={{ borderBottom: '1px solid #2a3350' }}>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#e2e8f0' }}>{st.name}</td>
                      <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace' }}>{st.admNo}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <input type="number" min={0} max={100} value={score ?? ''}
                          onChange={e => { setScores(p => ({ ...p, [st.name]: e.target.value })); setSaved(false); }}
                          style={{ width: 72, textAlign: 'center', padding: '6px 8px', fontSize: 14, fontWeight: 700 }} />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {numScore !== null ? <GradeBadge score={numScore} /> : <span style={{ color: '#2a3350' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn variant="success" onClick={saveMarks}>{saved ? '✅ Saved!' : '💾 Save Marks'}</Btn>
          </div>
        </Card>
      )}

      {selClass && classSubjects.length === 0 && (
        <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No subjects found for {selClass}. Contact your administrator to set up subjects.</div></Card>
      )}
    </div>
  );
}

/* ── View Results (read-only, only my subjects) ── */
function TeacherResults({ user, data }) {
  const mySubjects     = user.teacherSubjects || [];
  const mySubjectNames = mySubjects.map(s => s.subject);
  const canSeeAll      = user.isClassTeacher || user.canEnterAllMarks;

  const myTeachingClasses = [...new Set(mySubjects.flatMap(s => s.classes))];
  const allClasses         = getAllClasses(data);

  const availableClasses = user.canEnterAllMarks
    ? allClasses
    : [...new Set([
        ...myTeachingClasses,
        ...(user.isClassTeacher && user.classTeacherOf ? [user.classTeacherOf] : []),
      ])];

  const [selClass, setSelClass]   = useState(availableClasses[0] || '');
  const [selExamId, setSelExamId] = useState('');

  const classExams = (data.exams || []).filter(e => e.class == selClass);
  const selExam    = classExams.find(e => String(e.id) == String(selExamId));
  const students   = (data.students || []).filter(s => s.class == selClass);

  // Subjects visible to this teacher in this class
  const visibleSubjects = selExam
    ? [...new Set(Object.values(selExam.results || {}).flatMap(r => Object.keys(r)))]
        .filter(sub => canSeeAll ? true : mySubjectNames.includes(sub))
    : [];

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>📊 View Results</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selClass} onChange={e => { setSelClass(e.target.value); setSelExamId(''); }} style={{ minWidth: 150 }}>
          <option value="">— Select class —</option>
          {[...new Set(availableClasses)].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {selClass && classExams.length > 0 && (
          <select value={selExamId} onChange={e => setSelExamId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">— Select exam —</option>
            {classExams.map(e => <option key={e.id} value={e.id}>{e.name} (Term {e.term})</option>)}
          </select>
        )}
      </div>

      {!canSeeAll && mySubjectNames.length > 0 && (
        <Alert type="info"><Icon name="alert" size={14} /> You can only see results for your subjects: <strong>{mySubjectNames.join(', ')}</strong></Alert>
      )}

      {selExam ? (
        visibleSubjects.length === 0 ? (
          <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No marks entered yet for this exam.</div></Card>
        ) : (
        <Card noPad>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a3350', fontWeight: 600, color: '#e2e8f0' }}>
            {selExam.name} — {selClass} · Term {selExam.term} · {selExam.year}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e2435' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Name</th>
                  {visibleSubjects.map(s => <th key={s} style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontSize: 11, fontWeight: 600 }}>{s}</th>)}
                  {canSeeAll && <th style={{ padding: '10px 12px', textAlign: 'center', color: '#10b981', fontSize: 11, fontWeight: 600 }}>Total</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((st, idx) => {
                  const scores = visibleSubjects.map(sub => {
                    const cell = selExam.results?.[st.name]?.[sub];
                    return getScore(cell);
                  });
                  const total = scores.reduce((a, v) => a + (v ?? 0), 0);
                  return (
                    <tr key={st.id} style={{ borderBottom: '1px solid #2a3350' }}>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11 }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: '#e2e8f0' }}>{st.name}</td>
                      {scores.map((score, si) => (
                        <td key={si} style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {score !== null ? (
                            <span style={{ fontWeight: 700, color: score >= 60 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444' }}>{score}</span>
                          ) : <span style={{ color: '#2a3350' }}>—</span>}
                        </td>
                      ))}
                      {canSeeAll && (
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#4f8ef7' }}>{total}</td>
                      )}
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

/* ── My Class (class teachers only) ── */
function TeacherClass({ user, data, setData }) {
  const myStudents = (data.students || []).filter(s => s.class == user.classTeacherOf);
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null); // null = add new
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');

  const BLANK = { name: '', admNo: '', gender: 'Male', dob: '', parentName: '', parentPhone: '', status: 'active' };

  function openAdd() {
    setEditStudent(null);
    setForm({ ...BLANK, class: user.classTeacherOf });
    setShowModal(true);
  }

  function openEdit(st) {
    setEditStudent(st);
    setForm({ ...st });
    setShowModal(true);
  }

  function save() {
    if (!form.name?.trim()) { alert('Student name is required.'); return; }
    if (editStudent) {
      setData(d => ({ ...d, students: d.students.map(s => s.id === editStudent.id ? { ...s, ...form } : s) }));
    } else {
      const newId = Date.now();
      setData(d => ({ ...d, students: [...d.students, { id: newId, ...form, class: user.classTeacherOf }] }));
    }
    setShowModal(false);
  }

  const filtered = myStudents.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.admNo || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>👩‍🏫 My Class — {user.classTeacherOf}</div>
        <Btn onClick={openAdd}><Icon name="add" size={14} /> Add Student</Btn>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <SectionTitle icon="students">{myStudents.length} Students</SectionTitle>
          <input placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200, fontSize: 12 }} />
        </div>
        {filtered.length == 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>{search ? 'No students match your search.' : 'No students in this class yet. Click "Add Student" to add one.'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((st, i) => (
              <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: '#1e2435', borderRadius: 8, border: '1px solid #2a3350' }}>
                <div style={{ fontSize: 13, color: '#64748b', minWidth: 24, textAlign: 'right' }}>{i + 1}</div>
                <Avatar name={st.name} size={32} color="#4f8ef7" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{st.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Adm: {st.admNo} · {st.gender}
                    {st.parentName && <span> · Parent: {st.parentName}</span>}
                    {st.parentPhone && <span> · 📱 {st.parentPhone}</span>}
                  </div>
                </div>
                <Tag color={!st.status || st.status == 'active' ? 'green' : 'red'}>{st.status || 'active'}</Tag>
                <Btn size="sm" variant="ghost" onClick={() => openEdit(st)} title="Edit student"><Icon name="edit" size={13} /></Btn>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add / Edit Student Modal */}
      <Modal show={showModal} onClose={() => setShowModal(false)} title={editStudent ? `Edit: ${editStudent.name}` : 'Add New Student'}>
        <FormRow>
          <FormGroup label="Full Name *">
            <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Kamau Mwangi" autoFocus />
          </FormGroup>
          <FormGroup label="Admission No">
            <input value={form.admNo || ''} onChange={e => setForm({ ...form, admNo: e.target.value })} placeholder="e.g. KCS/001/2026" />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Gender">
            <select value={form.gender || 'Male'} onChange={e => setForm({ ...form, gender: e.target.value })}>
              <option>Male</option>
              <option>Female</option>
            </select>
          </FormGroup>
          <FormGroup label="Date of Birth">
            <input type="date" value={form.dob || ''} onChange={e => setForm({ ...form, dob: e.target.value })} />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Parent / Guardian Name">
            <input value={form.parentName || ''} onChange={e => setForm({ ...form, parentName: e.target.value })} placeholder="e.g. Mary Kamau" />
          </FormGroup>
          <FormGroup label="Parent Phone">
            <input value={form.parentPhone || ''} onChange={e => setForm({ ...form, parentPhone: e.target.value })} placeholder="0712345678" />
          </FormGroup>
        </FormRow>
        <FormGroup label="Status">
          <select value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="transferred">Transferred</option>
            <option value="completed">Completed</option>
          </select>
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
          <Btn onClick={save}><Icon name={editStudent ? 'check' : 'add'} size={14} /> {editStudent ? 'Save Changes' : 'Add Student'}</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ── Notifications ── */
function TeacherNotifs({ user, data, setData }) {
  function markRead(id) {
    setData(d => ({ ...d, notifications: (d.notifications || []).map(n => n.id == id ? { ...n, read: true } : n) }));
  }
  function markAllRead() {
    setData(d => ({ ...d, notifications: (d.notifications || []).map(n => n.to == user.staffId ? { ...n, read: true } : n) }));
  }

  const myNotifs = (data.notifications || []).filter(n => n.to == user.staffId).sort((a, b) => b.date.localeCompare(a.date));
  const unread   = myNotifs.filter(n => !n.read).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>🔔 Notifications {unread > 0 && <span style={{ fontSize: 14, background: '#ef4444', color: '#fff', borderRadius: 20, padding: '2px 8px', marginLeft: 8 }}>{unread}</span>}</div>
        {unread > 0 && <Btn variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Btn>}
      </div>
      {myNotifs.length == 0 ? (
        <Card><div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>No notifications yet.</div></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myNotifs.map(n => (
            <div key={n.id} style={{ background: '#171b26', border: `1px solid ${n.read ? '#2a3350' : '#4f8ef750'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? '#2a3350' : '#4f8ef7', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: n.read ? '#94a3b8' : '#e2e8f0', lineHeight: 1.5 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>From: {n.from} · {n.date}</div>
              </div>
              {!n.read && <Btn size="sm" variant="ghost" onClick={() => markRead(n.id)}>Mark read</Btn>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
