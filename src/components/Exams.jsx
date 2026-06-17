import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, GradeBadge, Alert, Icon } from './UI';
import { getGrade, GRADES_CBC, canEnterScores, getClassTeacherStaffId, getTeacherSubjects, getAllClasses, getScore, getStreamFromClass, getSiblingStreams, getSubjectsForClass } from '../data/initialData';
import { printClassList, printReportForm, printAllReportForms, computeRankings, printSubjectPerformance } from '../utils/print';

export default function Exams({ data, setData, user }) {
  const isPrincipal  = user.role === 'principal';
  const isClassTeacher = user.isClassTeacher;
  const myClass      = user.classTeacherOf;
  const mySubjects   = (user.teacherSubjects || []).map(s => s.subject);

  // Which classes can this user see results for?
  function getAccessibleClasses() {
    const all = getAllClasses(data);
    if (isPrincipal) return all;
    if (isClassTeacher) return [myClass];
    return (user.teacherSubjects || []).flatMap(s => s.classes).filter((v, i, a) => a.indexOf(v) === i);
  }

  const accessibleClasses = getAccessibleClasses();

  const [selClass, setSelClass] = useState(accessibleClasses[0] || getAllClasses(data)[0] || '');
  const [showSetupSubjects, setShowSetupSubjects] = useState(false);
  const [setupSubjectInput, setSetupSubjectInput] = useState('');
  const classSubjects = getSubjectsForClass(selClass, data);
  const [selExamId, setSelExamId] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const [showEditReq, setShowEditReq] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editNewScore, setEditNewScore] = useState('');

  const DEFAULT_EXAM_NAMES = [
    'Opening Exam', 'Mid-Term Exam', 'End-Term Exam',
    'CAT 1', 'CAT 2', 'CAT 3',
    'Mock Exam', 'Pre-Mock Exam', 'KCPE Mock',
    'Assignment 1', 'Assignment 2',
  ];
  const allClassesList = getAllClasses(data);

  const blankExamForm = () => ({
    name: '', customName: '',
    term: String(data.currentTerm || '1'),
    type: 'beginning',
    class: selClass,
    year: String(data.currentYear || new Date().getFullYear()),
    forAllClasses: false,
    selectedStreams: [], // for stream-level selection when class has streams
  });
  const [examForm, setExamForm] = useState(blankExamForm);
  const [scores, setScores]     = useState({});
  const [enterSubjects, setEnterSubjects] = useState([]);
  const [enterExam, setEnterExam] = useState(null);

  const classExams     = data.exams.filter(e => e.class === selClass);
  const selExam        = classExams.find(e => e.id === selExamId) || classExams[0] || null;
  const classStudents  = data.students.filter(s => s.class === selClass);

  // All subjects that appear in this exam
  const examSubjects = selExam
    ? [...new Set(Object.values(selExam.results).flatMap(r => Object.keys(r)))]
    : [];

  // Subjects this user can see scores for (subject teacher only sees their subjects)
  function getVisibleSubjects(exam) {
    if (!exam) return [];
    const all = [...new Set(Object.values(exam.results).flatMap(r => Object.keys(r)))];
    if (isPrincipal || isClassTeacher) return all;
    return all.filter(s => mySubjects.includes(s));
  }

  const visibleSubjects = selExam ? getVisibleSubjects(selExam) : [];

  // Subjects this user can ENTER scores for in selClass
  // Class teacher can enter ALL subjects for their class
  function getEnterableSubjects() {
    if (isPrincipal) return getSubjectsForClass(selClass, data);
    if (isClassTeacher && myClass === selClass) return getSubjectsForClass(selClass, data);
    return (user.teacherSubjects || [])
      .filter(s => s.classes.includes(selClass))
      .map(s => s.subject);
  }

  const enterableSubjects = getEnterableSubjects();

  /* ── Ranking ──────────────────────────────────────── */
  function rankStudents(exam) {
    if (!exam) return [];

    // All streams of same base class for overall position
    const siblingClasses = getSiblingStreams(exam.class, data);

    // Find the matching exam for each sibling stream
    // (same name + term + year, different stream class)
    function findSiblingExam(cls) {
      if (cls === exam.class) return exam;
      return (data.exams || []).find(e =>
        e.class === cls &&
        e.term  === exam.term &&
        e.year  === exam.year &&
        e.name  === exam.name
      ) || null;
    }

    // Get results for a student using the correct exam for their stream
    function calcStats(student) {
      const sibExam   = findSiblingExam(student.class);
      const resultsObj = sibExam ? (sibExam.results || {}) : (exam.results || {});
      const res   = resultsObj[student.name] || {};
      const subs  = Object.keys(res);
      const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
      const mean  = subs.length ? Math.round(total / subs.length) : 0;
      return { total, mean, grade: getGrade(mean), results: res, subs };
    }

    // This stream's students only
    const streamStudents = data.students.filter(s => s.class === exam.class);
    // All sibling streams students
    const allSiblings    = data.students.filter(s => siblingClasses.includes(s.class));

    const overallRanked = allSiblings
      .map(s => ({ ...s, ...calcStats(s) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return streamStudents
      .map(s => ({ ...s, ...calcStats(s) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .map((s, i) => {
        const ov = overallRanked.findIndex(x => x.name === s.name);
        return {
          ...s,
          streamPos:  i + 1,
          streamOf:   streamStudents.length,
          overallPos: ov + 1,
          overallOf:  overallRanked.length,
        };
      });
  }

  const ranked = rankStudents(selExam);

  /* ── Create exam ──────────────────────────────────── */
  function createExam() {
    const finalName = examForm.customName.trim() || examForm.name;
    if (!finalName) { alert('Please enter an exam name.'); return; }

    // Determine which classes to create exams for
    let targetClasses = [];
    if (examForm.forAllClasses) {
      targetClasses = allClassesList;
    } else if (examForm.selectedStreams && examForm.selectedStreams.length > 0) {
      targetClasses = examForm.selectedStreams;
    } else {
      targetClasses = [examForm.class];
    }

    const newExams = targetClasses.map(cls => ({
      id: Date.now() + Math.random(),
      name: finalName,
      term: Number(examForm.term),
      type: examForm.type,
      class: cls,
      year: examForm.year,
      results: {},
    }));

    setData(d => ({ ...d, exams: [...d.exams, ...newExams] }));
    setShowAdd(false);
    setExamForm(blankExamForm());
    if (newExams.length > 1) alert(`Exam "${finalName}" created for ${newExams.length} classes.`);
  }

  /* ── Edit exam metadata ───────────────────────────── */
  function saveExamEdit() {
    const finalName = examForm.customName.trim() || examForm.name;
    if (!finalName) { alert('Please enter an exam name.'); return; }
    setData(d => ({
      ...d,
      exams: d.exams.map(ex => ex.id === selExam.id
        ? { ...ex, name: finalName, term: Number(examForm.term), type: examForm.type, year: examForm.year }
        : ex
      ),
    }));
    setShowEdit(false);
  }

  /* ── Open score entry ─────────────────────────────── */
  function openEnterScores(exam) {
    const subs = enterableSubjects;
    setEnterExam(exam);
    setEnterSubjects(subs);
    const init = {};
    classStudents.forEach(st => {
      init[st.name] = {};
      subs.forEach(sub => {
        const existing = exam.results[st.name]?.[sub];
        init[st.name][sub] = getScore(existing) ?? '';
      });
    });
    setScores(init);
    setShowEnter(true);
  }

  /* ── Save scores (initial submission) ────────────────*/
  function saveScores() {
    setData(d => ({
      ...d,
      exams: d.exams.map(ex => {
        if (ex.id !== enterExam.id) return ex;
        const newResults = { ...ex.results };
        classStudents.forEach(st => {
          if (!newResults[st.name]) newResults[st.name] = {};
          enterSubjects.forEach(sub => {
            const v = Number(scores[st.name]?.[sub]);
            if (!isNaN(v) && scores[st.name]?.[sub] !== '') {
              newResults[st.name][sub] = { score: v, submittedBy: user.staffId, locked: false };
            }
          });
        });
        return { ...ex, results: newResults };
      }),
      // Notify class teacher of new submission (if submitter is not class teacher)
      notifications: [
        ...(d.notifications || []),
        ...(() => {
          const ctStaffId = getClassTeacherStaffId(selClass, d);
          if (ctStaffId && ctStaffId !== user.staffId) {
            return [{ id: Date.now(), to: ctStaffId, from: user.name, message: `${user.name} submitted scores for ${enterableSubjects.join(', ')} — ${selClass} · ${enterExam.name}`, date: new Date().toISOString().split('T')[0], read: false }];
          }
          return [];
        })(),
      ],
    }));
    setShowEnter(false);
  }

  /* ── Request edit ─────────────────────────────────── */
  function openEditRequest(studentName, subject, currentScore, examId) {
    setEditTarget({ studentName, subject, currentScore, examId });
    setEditNewScore(String(currentScore));
    setShowEditReq(true);
  }

  function submitEditRequest() {
    const newScore = Number(editNewScore);
    if (isNaN(newScore) || newScore < 0 || newScore > 100) { alert('Please enter a valid score (0–100)'); return; }
    if (newScore === editTarget.currentScore) { alert('New score is the same as current score.'); return; }

    const ctStaffId = getClassTeacherStaffId(selClass, data);

    const req = {
      id: Date.now(),
      examId: editTarget.examId,
      studentName: editTarget.studentName,
      subject: editTarget.subject,
      oldScore: editTarget.currentScore,
      newScore,
      requestedBy: user.staffId,
      requestedByName: user.name,
      approvals: {
        classTeacher: (user.isClassTeacher && user.classTeacherOf === selClass) ? 'approved' : null,
        principal:    isPrincipal ? 'approved' : null,
      },
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
    };

    // Check if both are already approved (e.g. principal is class teacher)
    let finalReq = req;
    let finalData = data;
    if (req.approvals.classTeacher === 'approved' && req.approvals.principal === 'approved') {
      finalReq = { ...req, status: 'approved' };
      // Apply immediately
      finalData = applyEditRequest(data, finalReq);
    }

    const notifications = [...(finalData.notifications || [])];
    // Notify class teacher
    if (ctStaffId && ctStaffId !== user.staffId) {
      notifications.push({ id: Date.now() + 1, to: ctStaffId, from: user.name, message: `Edit request: ${editTarget.studentName} — ${editTarget.subject} (${editTarget.currentScore}→${newScore}). Requested by ${user.name}. Your approval needed.`, date: new Date().toISOString().split('T')[0], read: false });
    }
    // Notify principal
    if (!isPrincipal) {
      notifications.push({ id: Date.now() + 2, to: data.teachers.find(t => t.admin)?.staffId || 'T000', from: user.name, message: `Edit request: ${editTarget.studentName} — ${editTarget.subject} (${editTarget.currentScore}→${newScore}). Requested by ${user.name}. Your approval needed.`, date: new Date().toISOString().split('T')[0], read: false });
    }
    // Notify teacher who originally submitted (if different)
    const origTeacher = data.exams.find(e => e.id === editTarget.examId)?.results?.[editTarget.studentName]?.[editTarget.subject]?.submittedBy;
    if (origTeacher && origTeacher !== user.staffId && origTeacher !== ctStaffId) {
      notifications.push({ id: Date.now() + 3, to: origTeacher, from: user.name, message: `Edit request on your mark: ${editTarget.studentName} — ${editTarget.subject} (${editTarget.currentScore}→${newScore}). Requested by ${user.name}.`, date: new Date().toISOString().split('T')[0], read: false });
    }

    setData(d => ({
      ...finalData,
      editRequests: [...(finalData.editRequests || []), finalReq],
      notifications,
    }));

    setShowEditReq(false);
    if (finalReq.status === 'approved') {
      alert('Score updated immediately (all approvals already granted).');
    } else {
      alert('Edit request submitted. Approval needed from class teacher and principal.');
    }
  }

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

  /* ── Can this user request an edit of a score? ────── */
  function canRequestEdit(subject, exam) {
    if (!exam) return false;
    if (isPrincipal) return true;
    // Subject teacher can request edit for their subject
    if (mySubjects.includes(subject)) return true;
    // Class teacher can request edit for any subject in their class
    if (isClassTeacher && myClass === exam.class) return true;
    return false;
  }

  /* ── UI ───────────────────────────────────────────── */
  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selClass} onChange={e => { setSelClass(e.target.value); setSelExamId(null); }} style={{ width: 160 }}>
          {accessibleClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {classExams.length > 0 && (
          <select value={selExamId || ''} onChange={e => setSelExamId(Number(e.target.value) || null)} style={{ width: 240 }}>
            {classExams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selExam && enterableSubjects.length > 0 && (
            <Btn variant="ghost" size="sm" onClick={() => openEnterScores(selExam)}>
              <Icon name="edit" size={13} /> Enter My Scores
            </Btn>
          )}
          {selExam && (isClassTeacher || isPrincipal) && (
            <>
              <Btn variant="ghost" size="sm" onClick={() => printClassList(ranked, visibleSubjects, selExam, data)}>
                <Icon name="print" size={13} /> Class List
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => printAllReportForms(selExam, data)}>
                <Icon name="report" size={13} /> All Reports
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => printSubjectPerformance(selExam, data)}>
                📊 Subject Performance
              </Btn>
            </>
          )}
          {(isPrincipal || isClassTeacher) && (
            <Btn onClick={() => { setExamForm(blankExamForm()); setShowAdd(true); }}><Icon name="add" size={14} /> New Exam</Btn>
          )}
          {isPrincipal && selExam && (
            <Btn variant="ghost" size="sm" onClick={() => {
              setExamForm({ ...blankExamForm(), name: selExam.name, customName: '', term: String(selExam.term), type: selExam.type || 'endterm', year: String(selExam.year) });
              setShowEdit(true);
            }}>
              ✎ Edit Exam
            </Btn>
          )}
          {isPrincipal && selExam && (
            <Btn variant="danger" size="sm" onClick={() => {
              if (window.confirm(`Delete exam "${selExam.name}" for ${selExam.class}? This cannot be undone.`)) {
                setData(d => ({ ...d, exams: d.exams.filter(e => e.id !== selExam.id) }));
                setSelExamId(null);
              }
            }}>
              <Icon name="trash" size={13} /> Delete Exam
            </Btn>
          )}
          {isPrincipal && (
            <Btn variant="ghost" size="sm" onClick={() => {
              const studentNames = new Set((data.students||[]).map(s=>s.name));
              const orphaned = (data.exams||[]).filter(ex => {
                const hasRealStudents = Object.keys(ex.results||{}).some(name=>studentNames.has(name));
                return !hasRealStudents && Object.keys(ex.results||{}).length > 0;
              });
              if (orphaned.length === 0) { alert('No orphaned exam records found. All exams have valid students.'); return; }
              if (window.confirm(`Found ${orphaned.length} exam record(s) with no matching students (from deleted/test students).\n\nDelete them?\n\n${orphaned.map(e=>e.name+' — '+e.class).join('\n')}`)) {
                setData(d => ({ ...d, exams: d.exams.filter(ex => {
                  const hasReal = Object.keys(ex.results||{}).some(name=>studentNames.has(name));
                  return hasReal || Object.keys(ex.results||{}).length === 0;
                })}));
                alert('Orphaned exam records removed.');
              }
            }}>
              🧹 Clean Orphaned Exams
            </Btn>
          )}
          {isPrincipal && (
            <Btn variant="ghost" onClick={() => { setSetupSubjectInput((getSubjectsForClass(selClass, data) || []).join('\n')); setShowSetupSubjects(true); }}>
              📚 Setup Subjects
            </Btn>
          )}
        </div>
      </div>

      {/* Info banner for subject teachers */}
      {!isPrincipal && !isClassTeacher && mySubjects.length > 0 && (
        <Alert type="info">
          <Icon name="alert" size={14} />
          You can only enter and view scores for: <strong>{mySubjects.join(', ')}</strong>. To edit a submitted score, use the edit request button — approval is required from the class teacher and principal.
        </Alert>
      )}

      {/* Grade key */}
      <Card style={{ marginBottom: 16, padding: '10px 16px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#64748b', marginRight: 4 }}>CBC:</span>
          {GRADES_CBC.map(g => (
            <span key={g.label} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: g.color + '20', color: g.color, border: `1px solid ${g.color}30` }}>
              {g.label} {g.scoreMin}–{g.scoreMax} ({g.points}pts)
            </span>
          ))}
        </div>
      </Card>

      {/* Results table */}
      {selExam ? (
        <Card noPad>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a3350', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{selExam.name} — {selClass}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {isClassTeacher ? 'Viewing all subjects for your class' : !isPrincipal ? `Showing: ${visibleSubjects.join(', ')}` : 'Full results view'}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={TS.table}>
              <thead>
                <tr>
                  <th style={TS.th}>#</th>
                  <th style={TS.th}>Name</th>
                  <th style={TS.th}>Adm No</th>
                  {visibleSubjects.map(s => <th key={s} style={TS.th}>{s}</th>)}
                  {(isClassTeacher || isPrincipal) && <><th style={TS.th}>Total</th><th style={TS.th}>Mean</th><th style={TS.th}>Grade</th><th style={TS.th}>Pos</th><th style={TS.th}>Strm Pos</th></>}
                  <th style={TS.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(s => (
                  <tr key={s.id}>
                    <td style={TS.td}>
                      <span style={{ fontWeight: 700, color: s.streamPos <= 3 ? '#f59e0b' : '#e2e8f0' }}>
                        {s.streamPos <= 3 ? ['🥇', '🥈', '🥉'][s.streamPos - 1] : s.streamPos}
                      </span>
                    </td>
                    <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                    <td style={TS.td}>{s.admNo}</td>
                    {visibleSubjects.map(sub => {
                      const cell    = s.results[sub];
                      const score   = cell?.score ?? cell ?? null;
                      const submittedBy = cell?.submittedBy;
                      const submitter   = submittedBy ? data.teachers.find(t => t.staffId === submittedBy) : null;
                      const canEdit     = canRequestEdit(sub, selExam);
                      return (
                        <td key={sub} style={{ ...TS.td, textAlign: 'center', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                            <span title={submitter ? `Submitted by ${submitter.name}` : ''}>{score ?? <span style={{ color: '#64748b' }}>—</span>}</span>
                            {score !== null && canEdit && (
                              <button onClick={() => openEditRequest(s.name, sub, score, selExam.id)}
                                title="Request score edit"
                                style={{ background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 11, padding: '1px 4px', borderRadius: 4, opacity: 0.7 }}>✎</button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {(isClassTeacher || isPrincipal) && (
                      <>
                        <td style={{ ...TS.td, fontWeight: 700 }}>{s.total}</td>
                        <td style={TS.td}>{s.mean}</td>
                        <td style={TS.td}><GradeBadge score={s.mean} /></td>
                        <td style={{ ...TS.td, fontWeight: 700, color: '#f59e0b' }}>
                          {s.overallPos}<span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>/{s.overallOf}</span>
                        </td>
                        <td style={{ ...TS.td, fontWeight: 700, color: '#4f8ef7' }}>
                          {s.streamPos}<span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>/{s.streamOf}</span>
                        </td>
                      </>
                    )}
                    <td style={TS.td}>
                      {(isClassTeacher || isPrincipal) && (
                        <Btn size="sm" variant="ghost" onClick={() => printReportForm(s, selExam, data)}>
                          <Icon name="print" size={12} />
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
                {ranked.length === 0 && (
                  <tr><td colSpan={visibleSubjects.length + 7} style={{ ...TS.td, textAlign: 'center', color: '#64748b', padding: 32 }}>
                    No students found. {enterableSubjects.length > 0 ? 'Click "Enter My Scores" to add marks.' : ''}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          {classExams.length === 0
            ? `No exams for ${selClass} yet.${(isPrincipal || isClassTeacher) ? ' Click "New Exam" to create one.' : ''}`
            : 'Select an exam to view results.'}
        </Card>
      )}

      {/* Subject Performance Summary (on-screen ranking) */}
      {selExam && (isPrincipal || isClassTeacher) && visibleSubjects.length > 0 && (() => {
        const subStats = visibleSubjects.map(sub => {
          const scores = classStudents
            .map(s => { const cell = selExam.results[s.name]?.[sub]; return getScore(cell); })
            .filter(v => v !== null && v !== undefined);
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return { sub, avg, count: scores.length };
        }).sort((a, b) => b.avg - a.avg);
        return (
          <Card style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📊 Subjects Ranked: Best → Weakest</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {subStats.map((s, i) => (
                <div key={s.sub} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#1e2435', borderRadius: 8, border: '1px solid #2a3350' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c32' : '#64748b' }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{s.sub}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: s.avg >= 60 ? '#10b98130' : s.avg >= 43 ? '#4f8ef730' : s.avg >= 25 ? '#f59e0b30' : '#ef444430', color: s.avg >= 60 ? '#10b981' : s.avg >= 43 ? '#4f8ef7' : s.avg >= 25 ? '#f59e0b' : '#ef4444' }}>
                    {s.avg}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Pending edit requests banner */}
      {(() => {
        const myPending = (data.editRequests || []).filter(r => r.status === 'pending' && r.requestedBy === user.staffId);
        return myPending.length > 0 ? (
          <Card style={{ marginTop: 16 }}>
            <SectionTitle icon="alert">My Pending Edit Requests</SectionTitle>
            {myPending.map(r => (
              <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #2a3350', fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{r.studentName}</span> — {r.subject}: {r.oldScore} → {r.newScore}
                <span style={{ marginLeft: 12, fontSize: 11, color: '#64748b' }}>
                  Class Teacher: <span style={{ color: r.approvals.classTeacher === 'approved' ? '#10b981' : '#f59e0b' }}>{r.approvals.classTeacher || 'Pending'}</span>
                  &nbsp;· Principal: <span style={{ color: r.approvals.principal === 'approved' ? '#10b981' : '#f59e0b' }}>{r.approvals.principal || 'Pending'}</span>
                </span>
              </div>
            ))}
          </Card>
        ) : null;
      })()}

      {/* Setup Subjects Modal */}
      <Modal show={showSetupSubjects} onClose={() => setShowSetupSubjects(false)} title={`Setup Subjects — ${selClass}`}>
        <Alert type="info">
          <Icon name="alert" size={14} />
          Enter one subject per line for <strong>{selClass}</strong>. These will be used when entering marks for this class.
        </Alert>
        <FormGroup label="Subjects (one per line)">
          <textarea
            rows={8}
            value={setupSubjectInput}
            onChange={e => setSetupSubjectInput(e.target.value)}
            placeholder="e.g.&#10;Mathematics&#10;English&#10;Kiswahili&#10;Science"
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
          />
        </FormGroup>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
          {setupSubjectInput.split('\n').filter(s => s.trim()).length} subjects configured
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowSetupSubjects(false)}>Cancel</Btn>
          <Btn variant="success" onClick={() => {
            const subs = setupSubjectInput.split('\n').map(s => s.trim()).filter(Boolean);
            setData(d => ({ ...d, subjectsByClass: { ...(d.subjectsByClass || {}), [selClass]: subs } }));
            setShowSetupSubjects(false);
          }}>Save Subjects</Btn>
        </div>
      </Modal>

      {/* Create Exam Modal */}
      <Modal show={showAdd} onClose={() => setShowAdd(false)} title="Create New Exam">
        {/* Suggested names */}
        <FormGroup label="Exam Name">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {DEFAULT_EXAM_NAMES.map(n => (
              <button key={n} onClick={() => setExamForm(f => ({ ...f, name: n, customName: '' }))}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${examForm.name === n && !examForm.customName ? '#4f8ef7' : '#2a3350'}`, background: examForm.name === n && !examForm.customName ? '#4f8ef720' : '#1e2435', color: examForm.name === n && !examForm.customName ? '#4f8ef7' : '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                {n}
              </button>
            ))}
          </div>
          <input
            value={examForm.customName}
            onChange={e => setExamForm(f => ({ ...f, customName: e.target.value, name: e.target.value ? '' : f.name }))}
            placeholder={examForm.name ? `Selected: "${examForm.name}" — or type a custom name` : 'Or type a custom exam name...'}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Final name: <strong style={{ color: '#e2e8f0' }}>{examForm.customName || examForm.name || '(none selected)'}</strong>
          </div>
        </FormGroup>

        <FormRow>
          <FormGroup label="Term">
            <select value={examForm.term} onChange={e => setExamForm(f => ({ ...f, term: e.target.value }))}>
              {['1','2','3'].map(t => <option key={t} value={t}>Term {t}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Type">
            <select value={examForm.type} onChange={e => setExamForm(f => ({ ...f, type: e.target.value }))}>
              <option value="beginning">Beginning of Term</option>
              <option value="midterm">Mid-Term</option>
              <option value="endterm">End of Term</option>
              <option value="cat">C.A.T</option>
              <option value="mock">Mock Exam</option>
              <option value="assignment">Assignment</option>
            </select>
          </FormGroup>
          <FormGroup label="Year">
            <input value={examForm.year} onChange={e => setExamForm(f => ({ ...f, year: e.target.value }))} style={{ width: 80 }} />
          </FormGroup>
        </FormRow>

        {/* All classes tick */}
        {isPrincipal && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
              <input type="checkbox" checked={examForm.forAllClasses} onChange={e => setExamForm(f => ({ ...f, forAllClasses: e.target.checked, selectedStreams: [] }))} />
              Apply to ALL classes (creates one exam per class)
            </label>
          </div>
        )}

        {/* Single class + stream picker (when not all-classes) */}
        {!examForm.forAllClasses && (
          <FormGroup label="Class">
            {(() => {
              // Find siblings for the selected class
              const siblings = getSiblingStreams(examForm.class, data);
              const hasStreams = siblings.length > 1;
              return (
                <div>
                  <select value={examForm.class} onChange={e => setExamForm(f => ({ ...f, class: e.target.value, selectedStreams: [] }))} style={{ width: '100%', marginBottom: hasStreams ? 8 : 0 }}>
                    {(isPrincipal ? allClassesList : [myClass]).filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {hasStreams && (
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>This class has streams — select which streams this exam covers:</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', color: '#e2e8f0' }}>
                          <input type="checkbox"
                            checked={examForm.selectedStreams.length === siblings.length}
                            onChange={e => setExamForm(f => ({ ...f, selectedStreams: e.target.checked ? [...siblings] : [f.class] }))}
                          /> All Streams
                        </label>
                        {siblings.map(s => (
                          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', color: '#e2e8f0' }}>
                            <input type="checkbox"
                              checked={examForm.selectedStreams.includes(s) || (examForm.selectedStreams.length === 0 && s === examForm.class)}
                              onChange={e => {
                                setExamForm(f => {
                                  const cur = f.selectedStreams.length > 0 ? f.selectedStreams : [f.class];
                                  return { ...f, selectedStreams: e.target.checked ? [...new Set([...cur, s])] : cur.filter(x => x !== s) };
                                });
                              }}
                            /> {s}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </FormGroup>
        )}

        {examForm.forAllClasses && (
          <Alert type="info">
            This exam will be created for <strong>{allClassesList.length} classes</strong>: {allClassesList.join(', ')}
          </Alert>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          <Btn onClick={createExam} disabled={!examForm.customName && !examForm.name}>Create Exam</Btn>
        </div>
      </Modal>

      {/* Edit Exam Modal */}
      <Modal show={showEdit} onClose={() => setShowEdit(false)} title={`Edit Exam — ${selExam?.name}`}>
        <FormGroup label="Exam Name">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {DEFAULT_EXAM_NAMES.map(n => (
              <button key={n} onClick={() => setExamForm(f => ({ ...f, name: n, customName: '' }))}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${examForm.name === n && !examForm.customName ? '#4f8ef7' : '#2a3350'}`, background: examForm.name === n && !examForm.customName ? '#4f8ef720' : '#1e2435', color: examForm.name === n && !examForm.customName ? '#4f8ef7' : '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                {n}
              </button>
            ))}
          </div>
          <input value={examForm.customName || examForm.name} onChange={e => setExamForm(f => ({ ...f, customName: e.target.value, name: '' }))} placeholder="Exam name" style={{ width: '100%', boxSizing: 'border-box' }} />
        </FormGroup>
        <FormRow>
          <FormGroup label="Term">
            <select value={examForm.term} onChange={e => setExamForm(f => ({ ...f, term: e.target.value }))}>
              {['1','2','3'].map(t => <option key={t} value={t}>Term {t}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Type">
            <select value={examForm.type} onChange={e => setExamForm(f => ({ ...f, type: e.target.value }))}>
              <option value="beginning">Beginning of Term</option>
              <option value="midterm">Mid-Term</option>
              <option value="endterm">End of Term</option>
              <option value="cat">C.A.T</option>
              <option value="mock">Mock Exam</option>
              <option value="assignment">Assignment</option>
            </select>
          </FormGroup>
          <FormGroup label="Year">
            <input value={examForm.year} onChange={e => setExamForm(f => ({ ...f, year: e.target.value }))} style={{ width: 80 }} />
          </FormGroup>
        </FormRow>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowEdit(false)}>Cancel</Btn>
          <Btn variant="success" onClick={saveExamEdit}>Save Changes</Btn>
        </div>
      </Modal>

      {/* Enter Scores Modal */}
      <Modal show={showEnter} onClose={() => setShowEnter(false)} title={`Enter Scores — ${enterExam?.name || ''}`} wide>
        {!isPrincipal && (
          <Alert type="info">
            <Icon name="alert" size={14} />
            You are entering scores for: <strong>{enterableSubjects.join(', ')}</strong> only.
          </Alert>
        )}
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={TS.table}>
            <thead>
              <tr>
                <th style={TS.th}>Student</th>
                {enterSubjects.map(s => <th key={s} style={TS.th}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {classStudents.map(st => (
                <tr key={st.id}>
                  <td style={{ ...TS.td, fontWeight: 500, whiteSpace: 'nowrap' }}>{st.name}</td>
                  {enterSubjects.map(sub => (
                    <td key={sub} style={{ ...TS.td, padding: '4px 6px' }}>
                      <input type="number" min={0} max={100} value={scores[st.name]?.[sub] ?? ''}
                        onChange={e => setScores(prev => ({ ...prev, [st.name]: { ...prev[st.name], [sub]: e.target.value } }))}
                        style={{ width: 58, textAlign: 'center', padding: '5px 4px' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowEnter(false)}>Cancel</Btn>
          <Btn variant="success" onClick={saveScores}>Save Scores</Btn>
        </div>
      </Modal>

      {/* Edit Request Modal */}
      <Modal show={showEditReq} onClose={() => setShowEditReq(false)} title="Request Score Edit">
        <Alert type="warning">
          <Icon name="alert" size={14} />
          Editing a submitted score requires approval from the class teacher AND the principal. All parties will be notified.
        </Alert>
        {editTarget && (
          <>
            <div style={{ background: '#1e2435', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
              <div><span style={{ color: '#64748b' }}>Student:</span> <strong>{editTarget.studentName}</strong></div>
              <div><span style={{ color: '#64748b' }}>Subject:</span> <strong>{editTarget.subject}</strong></div>
              <div><span style={{ color: '#64748b' }}>Current Score:</span> <strong style={{ color: '#f59e0b' }}>{editTarget.currentScore}</strong></div>
            </div>
            <FormGroup label="New Score (0 – 100)">
              <input type="number" min={0} max={100} value={editNewScore} onChange={e => setEditNewScore(e.target.value)} autoFocus />
            </FormGroup>
            <FormGroup label="Reason for edit (optional)">
              <textarea rows={2} placeholder="e.g. Marking error — student's script was re-marked" />
            </FormGroup>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowEditReq(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={submitEditRequest} disabled={!editNewScore}>Submit Edit Request</Btn>
        </div>
      </Modal>
    </div>
  );
}

const TS = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:    { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #2a3350', background: '#1e2435', whiteSpace: 'nowrap' },
  td:    { padding: '10px 12px', borderBottom: '1px solid #2a3350', color: '#e2e8f0' },
};
