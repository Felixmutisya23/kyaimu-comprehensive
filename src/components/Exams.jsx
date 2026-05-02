import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, GradeBadge, Alert, Icon } from './UI';
import { getGrade, GRADES_CBC, canEnterScores, getClassTeacherStaffId, getTeacherSubjects, getAllClasses, getScore, getStreamFromClass, getSiblingStreams } from '../data/initialData';
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
  const [selExamId, setSelExamId] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const [showEditReq, setShowEditReq] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { studentName, subject, currentScore, examId }
  const [editNewScore, setEditNewScore] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentStudent, setCommentStudent] = useState(null);
  const [ctComment, setCtComment] = useState('');
  const [principalComment, setPrincipalComment] = useState('');
  const [bulkCommentModal, setBulkCommentModal] = useState(false);
  const [bulkCtComment, setBulkCtComment] = useState('');
  const [bulkPrincipalComment, setBulkPrincipalComment] = useState('');
  const [combinedReportModal, setCombinedReportModal] = useState(false);
  const [examForm, setExamForm] = useState({ name: '', term: '1', type: 'beginning', class: selClass, year: new Date().getFullYear().toString() });
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
  function getEnterableSubjects() {
    if (isPrincipal) return data.subjects;
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
    const allSiblings    = data.students.filter(s => siblingClasses.includes(s.class));
    // This stream's students only
    const streamStudents = data.students.filter(s => s.class === exam.class);

    function calcStats(s) {
      const res   = exam.results[s.name] || {};
      const subs  = Object.keys(res);
      const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
      const mean  = subs.length ? Math.round(total / subs.length) : 0;
      return { total, mean, grade: getGrade(mean), results: res, subs };
    }

    const overallRanked = allSiblings
      .map(s => ({ ...s, ...calcStats(s) }))
      .sort((a, b) => b.total - a.total);

    return streamStudents
      .map(s => ({ ...s, ...calcStats(s) }))
      .sort((a, b) => b.total - a.total)
      .map((s, i) => {
        const ov = overallRanked.findIndex(x => x.name === s.name);
        return { ...s, streamPos: i + 1, overallPos: ov + 1 };
      });
  }

  const ranked = rankStudents(selExam);

  /* ── Create exam ──────────────────────────────────── */
  function createExam() {
    const newExam = { id: Date.now(), ...examForm, term: Number(examForm.term), results: {} };
    setData(d => ({ ...d, exams: [...d.exams, newExam] }));
    setShowAdd(false);
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
              <Btn variant="ghost" size="sm" onClick={() => {
                setBulkCtComment('');
                setBulkPrincipalComment('');
                setBulkCommentModal(true);
              }}>
                <Icon name="report" size={13} /> All Reports
              </Btn>
              {selExam && getSiblingStreams(selExam.class, data).length > 1 && (
                <Btn variant="ghost" size="sm" onClick={() => setCombinedReportModal(true)}>
                  <Icon name="report" size={13} /> All Reports (Combined)
                </Btn>
              )}
              <Btn variant="ghost" size="sm" onClick={() => printSubjectPerformance(selExam, data)}>
                📊 Subject Performance
              </Btn>
            </>
          )}
          {(isPrincipal || isClassTeacher) && (
            <Btn onClick={() => setShowAdd(true)}><Icon name="add" size={14} /> New Exam</Btn>
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
                  {(isClassTeacher || isPrincipal) && <><th style={TS.th}>Total</th><th style={TS.th}>Pts</th><th style={TS.th}>Mean</th><th style={TS.th}>Grade</th><th style={TS.th}>Pos</th><th style={TS.th}>Strm Pos</th></>}
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
                        <td style={{ ...TS.td, fontWeight: 700, color: '#7c3aed' }}>
                          {Object.keys(s.results).reduce((acc, sub) => {
                            const cell = s.results[sub];
                            const score = cell?.score ?? cell ?? null;
                            if (score !== null) {
                              const g = (data.gradesConfig || []).concat([]).sort((a,b) => b.scoreMin - a.scoreMin).find(g => score >= g.scoreMin);
                              return acc + (g ? g.points : 0);
                            }
                            return acc;
                          }, 0)}
                        </td>
                        <td style={TS.td}>{s.mean}</td>
                        <td style={TS.td}><GradeBadge score={s.mean} /></td>
                        <td style={{ ...TS.td, fontWeight: 700, color: '#f59e0b' }}>{s.overallPos}</td>
                        <td style={{ ...TS.td, fontWeight: 700, color: '#4f8ef7' }}>{s.streamPos}</td>
                      </>
                    )}
                    <td style={TS.td}>
                      {(isClassTeacher || isPrincipal) && (
                        <Btn size="sm" variant="ghost" onClick={() => {
                          setCommentStudent(s);
                          const saved = selExam.studentComments?.[s.name];
                          setCtComment(saved?.classTeacher || '');
                          setPrincipalComment(saved?.principal || '');
                          setShowCommentModal(true);
                        }}>
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

      {/* Create Exam Modal */}
      <Modal show={showAdd} onClose={() => setShowAdd(false)} title="Create New Exam">
        <FormGroup label="Exam Name"><input value={examForm.name} onChange={e => setExamForm({ ...examForm, name: e.target.value })} placeholder="e.g. Term 2 Midterm" /></FormGroup>
        <FormRow>
          <FormGroup label="Term"><select value={examForm.term} onChange={e => setExamForm({ ...examForm, term: e.target.value })}>{['1','2','3'].map(t => <option key={t} value={t}>Term {t}</option>)}</select></FormGroup>
          <FormGroup label="Type"><select value={examForm.type} onChange={e => setExamForm({ ...examForm, type: e.target.value })}><option value="beginning">Beginning of Term</option><option value="midterm">Midterm</option><option value="endterm">End of Term</option></select></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Class"><select value={examForm.class} onChange={e => setExamForm({ ...examForm, class: e.target.value })}>{(isPrincipal ? getAllClasses(data) : [myClass]).filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}</select></FormGroup>
          <FormGroup label="Year"><input value={examForm.year} onChange={e => setExamForm({ ...examForm, year: e.target.value })} /></FormGroup>
        </FormRow>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          <Btn onClick={createExam} disabled={!examForm.name}>Create Exam</Btn>
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

      {/* Feature 6: Comment Modal for single report */}
      <Modal show={showCommentModal} onClose={() => setShowCommentModal(false)} title={`Print Report — ${commentStudent?.name || ''}`}>
        <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>Optionally add comments before printing. Leave blank for empty comment boxes.</div>
        <FormGroup label="Class Teacher's Comment">
          <textarea rows={3} value={ctComment} onChange={e => setCtComment(e.target.value)} placeholder="e.g. A hardworking student who shows great potential..." style={{ width: '100%', resize: 'vertical' }} />
        </FormGroup>
        <FormGroup label="Principal's Comment">
          <textarea rows={3} value={principalComment} onChange={e => setPrincipalComment(e.target.value)} placeholder="e.g. Keep up the excellent work..." style={{ width: '100%', resize: 'vertical' }} />
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowCommentModal(false)}>Cancel</Btn>
          <Btn onClick={() => {
            // Save comments to exam data
            if (commentStudent) {
              setData(d => ({
                ...d,
                exams: d.exams.map(ex => ex.id !== selExam.id ? ex : {
                  ...ex,
                  studentComments: { ...(ex.studentComments || {}), [commentStudent.name]: { classTeacher: ctComment, principal: principalComment } }
                })
              }));
            }
            printReportForm(commentStudent, selExam, data, { classTeacherComment: ctComment, principalComment });
            setShowCommentModal(false);
          }}>
            <Icon name="print" size={13} /> Print
          </Btn>
        </div>
      </Modal>

      {/* Bulk comment modal */}
      <Modal show={bulkCommentModal} onClose={() => setBulkCommentModal(false)} title="Print All Reports">
        <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>Set default comments for all students. Individual overrides (set per-student) are preserved.</div>
        <FormGroup label="Default Class Teacher's Comment">
          <textarea rows={3} value={bulkCtComment} onChange={e => setBulkCtComment(e.target.value)} placeholder="e.g. Keep working hard this term..." style={{ width: '100%', resize: 'vertical' }} />
        </FormGroup>
        <FormGroup label="Default Principal's Comment">
          <textarea rows={3} value={bulkPrincipalComment} onChange={e => setBulkPrincipalComment(e.target.value)} placeholder="e.g. Congratulations on your performance..." style={{ width: '100%', resize: 'vertical' }} />
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setBulkCommentModal(false)}>Cancel</Btn>
          <Btn onClick={() => {
            printAllReportForms(selExam, data, { defaultCtComment: bulkCtComment, defaultPrincipalComment: bulkPrincipalComment });
            setBulkCommentModal(false);
          }}>
            <Icon name="print" size={13} /> Print All Reports
          </Btn>
        </div>
      </Modal>

      {/* Combined streams report modal */}
      <Modal show={combinedReportModal} onClose={() => setCombinedReportModal(false)} title="Print All Reports (Combined Streams)">
        <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>
          This will print reports for ALL streams of {selExam ? selExam.class.replace(/\s+(East|West|North|South|A|B|C|D)$/i, '') : ''} combined, using overall position across all streams.
        </div>
        <FormGroup label="Default Principal's Comment">
          <textarea rows={3} value={bulkPrincipalComment} onChange={e => setBulkPrincipalComment(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setCombinedReportModal(false)}>Cancel</Btn>
          <Btn onClick={() => {
            printAllReportForms(selExam, data, { defaultPrincipalComment: bulkPrincipalComment, combined: true });
            setCombinedReportModal(false);
          }}>
            <Icon name="print" size={13} /> Print Combined Reports
          </Btn>
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
