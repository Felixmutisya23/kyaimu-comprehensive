import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, GradeBadge, Alert, Icon } from './UI';
import { getGrade, GRADES_CBC, canEnterScores, getClassTeacherStaffId, getTeacherSubjects, getAllClasses, getScore, getStreamFromClass, getSiblingStreams, getSubjectsForClass, getExamColumnsForClass, computeColumnScore } from '../data/initialData';
import { printClassList, printReportForm, printAllReportForms, printOverallClassList, computeRankings, printSubjectPerformance } from '../utils/print';

export default function Exams({ data, setData, user, flushSave , isDark, themeVars }) {
  const _bg = themeVars ? themeVars['--bg'] : 'var(--bg)';
  const _surface = themeVars ? themeVars['--surface'] : 'var(--surface)';
  const _text = themeVars ? themeVars['--text'] : 'var(--text)';

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
  // Row-based editor: each row remembers its ORIGINAL name (what's already
  // saved, and what any existing exam marks are keyed by) plus its CURRENT
  // (possibly edited) name. This is what makes renaming safe — we always
  // know exactly which old subject a new name replaces, so we can carry
  // forward every student's existing score under the new name instead of
  // orphaning it. A row with no original (newly added) is just inserted.
  const [setupSubjectRows, setSetupSubjectRows] = useState([]); // [{ original, current }]
  const [newSubjectName, setNewSubjectName] = useState('');
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
    selectedStreams: [],
    subjectColumns: null,
  });
  const [examForm, setExamForm] = useState(blankExamForm);
  const [scores, setScores]     = useState({});
  const [enterSubjects, setEnterSubjects] = useState([]);
  const [enterExam, setEnterExam] = useState(null);

  const classExams     = data.exams.filter(e => e.class === selClass);
  const selExam        = classExams.find(e => e.id === selExamId) || classExams[0] || null;
  const classStudents  = [...data.students.filter(s => s.class === selClass)].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Subjects that already have actual marks in this exam
  const markedSubjects = selExam
    ? [...new Set(Object.values(selExam.results || {}).flatMap(r => Object.keys(r)))]
    : [];

  // Exam columns — ALWAYS reflects the live Setup Subjects list for selClass.
  // Per-exam subjectColumns snapshots are ignored here so that adding or
  // renaming a subject in Setup Subjects takes effect on every exam for
  // this class immediately — past, present, and future.
  const examColumns = (() => {
    const cols = getExamColumnsForClass(selClass, data, null);
    if (!selExam || markedSubjects.length === 0) return cols;
    const coveredByCol = new Set(cols.flatMap(c =>
      c.type === 'group' ? c.components : [c.subject || c.name]
    ));
    const extraCols = markedSubjects
      .filter(s => !coveredByCol.has(s) && !cols.some(c => c.name === s))
      .map(s => ({ name: s, type: 'single', subject: s }));
    return [...cols, ...extraCols];
  })();

  const columnNames = examColumns.map(c => c.name);

  function getVisibleSubjects(exam) {
    if (!exam) return [];
    if (isPrincipal || isClassTeacher) return columnNames;
    return examColumns
      .filter(col => {
        if (col.type === 'single') return mySubjects.includes(col.subject || col.name);
        if (col.type === 'group')  return col.components.some(c => mySubjects.includes(c));
        return false;
      })
      .map(c => c.name);
  }

  const visibleSubjects = selExam ? getVisibleSubjects(selExam) : [];

  function getEnterableSubjects() {
    const settingsSubs = new Set(getSubjectsForClass(selClass, data));
    markedSubjects.forEach(s => settingsSubs.add(s));
    const allValid = [...settingsSubs];
    if (isPrincipal) return allValid;
    if (isClassTeacher && myClass === selClass) return allValid;
    return (user.teacherSubjects || [])
      .filter(s => s.classes.includes(selClass))
      .map(s => s.subject)
      .filter(s => settingsSubs.has(s));
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
  const hasStreams = selExam ? getSiblingStreams(selExam.class, data).length > 1 : false;

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
    // Flush immediately so marks never lost if teacher closes browser quickly
    if (flushSave) setTimeout(() => flushSave(), 50);
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

    // Principal edits marks directly — no approval needed
    if (isPrincipal) {
      setData(d => ({
        ...d,
        exams: d.exams.map(ex => {
          if (ex.id !== editTarget.examId) return ex;
          const newResults = { ...ex.results };
          if (!newResults[editTarget.studentName]) newResults[editTarget.studentName] = {};
          newResults[editTarget.studentName] = {
            ...newResults[editTarget.studentName],
            [editTarget.subject]: { score: newScore, submittedBy: user.staffId, locked: false, editedByPrincipal: true },
          };
          return { ...ex, results: newResults };
        }),
      }));
      setShowEditReq(false);
      if (flushSave) setTimeout(() => flushSave(), 50);
      return;
    }

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
        <select value={selClass} onChange={e => { setSelClass(e.target.value); setSelExamId(null); }}
          style={{ width: 160, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
          {accessibleClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {classExams.length > 0 && (() => {
          // Group exams by year for better navigation
          const byYear = {};
          classExams.forEach(e => {
            const yr = e.year || 'Unknown';
            if (!byYear[yr]) byYear[yr] = [];
            byYear[yr].push(e);
          });
          const years = Object.keys(byYear).sort((a, b) => b - a); // newest first
          return (
            <select value={selExamId || ''} onChange={e => setSelExamId(Number(e.target.value) || null)}
              style={{ width: 260, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
              {years.map(yr => (
                <optgroup key={yr} label={`── ${yr} ──`} style={{ color: 'var(--text-sub)', fontSize: 11 }}>
                  {byYear[yr].map(e => (
                    <option key={e.id} value={e.id}>
                      Term {e.term} · {e.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          );
        })()}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selExam && enterableSubjects.length > 0 && (
            <Btn variant="ghost" size="sm" onClick={() => openEnterScores(selExam)}>
              <Icon name="edit" size={13} /> Enter My Scores
            </Btn>
          )}
          {selExam && (isClassTeacher || isPrincipal) && (
            <>
              <Btn variant="ghost" size="sm" onClick={() => printClassList(ranked, visibleSubjects, selExam, data)}>
                <Icon name="print" size={13} /> Stream List
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => printOverallClassList(selExam, data)}>
                🏫 Overall Class List
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
            <Btn variant="ghost" onClick={() => {
              // Show ALL subjects that have marks in any exam for this class
              // PLUS subjects from Settings — so principal sees everything
              const markedInAnyExam = new Set(
                (data.exams || [])
                  .filter(e => e.class === selClass)
                  .flatMap(e => Object.values(e.results || {}).flatMap(r => Object.keys(r)))
              );
              const settingsSubs = getSubjectsForClass(selClass, data) || [];
              settingsSubs.forEach(s => markedInAnyExam.add(s));
              setSetupSubjectRows([...markedInAnyExam].map(s => ({ original: s, current: s })));
              setNewSubjectName('');
              setShowSetupSubjects(true);
            }}>
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>CBC:</span>
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
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{selExam.name} — {selClass}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isClassTeacher ? 'Viewing all subjects for your class' : !isPrincipal ? `Showing: ${visibleSubjects.join(', ')}` : 'Full results view'}
            </div>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh' }}>
            <table style={{ ...TS.table, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ ...TS.th, position: 'sticky', left: 0, zIndex: 20, background: 'var(--table-header-bg, #1e40af)' }}>#</th>
                  <th style={{ ...TS.th, position: 'sticky', left: 32, zIndex: 20, background: 'var(--table-header-bg, #1e40af)', minWidth: 140 }}>Name</th>
                  <th style={TS.th}>Adm No</th>
                  {visibleSubjects.map(s => <th key={s} style={{ ...TS.th, whiteSpace: 'nowrap' }}>{s}</th>)}
                  {(isClassTeacher || isPrincipal) && <><th style={TS.th}>Total</th><th style={TS.th}>Mean</th><th style={TS.th}>Grade</th><th style={TS.th}>Pos</th>{hasStreams && <th style={TS.th}>Strm Pos</th>}</>}
                  <th style={TS.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(s => (
                  <tr key={s.id}>
                    <td style={TS.td}>
                      <span style={{ fontWeight: 700, color: s.streamPos <= 3 ? '#f59e0b' : 'var(--text)' }}>
                        {s.streamPos <= 3 ? ['🥇', '🥈', '🥉'][s.streamPos - 1] : s.streamPos}
                      </span>
                    </td>
                    <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                    <td style={TS.td}>{s.admNo}</td>
                    {visibleSubjects.map(colName => {
                      const col   = examColumns.find(c => c.name === colName) || { name: colName, type: 'single', subject: colName };
                      const score = computeColumnScore(col, s.results);
                      const canEdit = col.type === 'single' && canRequestEdit(col.subject || col.name, selExam);
                      return (
                        <td key={colName} style={{ ...TS.td, textAlign: 'center', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                            <span title={col.type === 'group' ? col.components.map(c => `${c}: ${getScore(s.results[c]) ?? '—'}`).join(', ') : ''}
                              style={{ color: col.type === 'group' ? '#4f8ef7' : 'inherit', fontWeight: col.type === 'group' ? 700 : 'inherit' }}>
                              {score ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </span>
                            {score !== null && canEdit && (
                              <button onClick={() => openEditRequest(s.name, col.subject || col.name, score, selExam.id)}
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
                          {s.overallPos}<span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>/{s.overallOf}</span>
                        </td>
                        {hasStreams && (
                          <td style={{ ...TS.td, fontWeight: 700, color: '#4f8ef7' }}>
                            {s.streamPos}<span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>/{s.streamOf}</span>
                          </td>
                        )}
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
                  <tr><td colSpan={visibleSubjects.length + 7} style={{ ...TS.td, textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                    No students found. {enterableSubjects.length > 0 ? 'Click "Enter My Scores" to add marks.' : ''}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
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
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>📊 Subjects Ranked: Best → Weakest</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {subStats.map((s, i) => (
                <div key={s.sub} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#f59e0b' : i === 1 ? 'var(--text-sub)' : i === 2 ? '#cd7c32' : 'var(--text-muted)' }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{s.sub}</span>
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
              <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{r.studentName}</span> — {r.subject}: {r.oldScore} → {r.newScore}
                <span style={{ marginLeft: 12, fontSize: 11, color: 'var(--text-muted)' }}>
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
          Showing ALL subjects — both from Settings and those already used in exams for <strong>{selClass}</strong>.
          Rename a subject and marks move with it automatically.
          <strong style={{ color: '#f59e0b' }}> Only delete subjects with no marks — deleting a subject with marks will hide those marks.</strong>
          <br/>Changes here do <strong>not</strong> affect Settings subjects used for timetable or teacher assignment.
        </Alert>

        <FormGroup label={`Subjects (${setupSubjectRows.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {setupSubjectRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={row.current}
                  onChange={e => setSetupSubjectRows(rows => rows.map((r, ri) => ri === i ? { ...r, current: e.target.value } : r))}
                  style={{ flex: 1 }}
                />
                <Btn size="sm" variant="danger" onClick={() => {
                  if (row.original && !window.confirm(`Remove "${row.original}" from ${selClass}? Any marks already entered for this subject will be KEPT in the exam data but it will no longer appear in the subject list or in new mark entry.`)) return;
                  setSetupSubjectRows(rows => rows.filter((_, ri) => ri !== i));
                }}>
                  <Icon name="trash" size={12} />
                </Btn>
              </div>
            ))}
          </div>
        </FormGroup>

        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <input
            value={newSubjectName}
            onChange={e => setNewSubjectName(e.target.value)}
            placeholder="New subject name…"
            onKeyDown={e => {
              if (e.key === 'Enter' && newSubjectName.trim()) {
                setSetupSubjectRows(rows => [...rows, { original: '', current: newSubjectName.trim() }]);
                setNewSubjectName('');
              }
            }}
          />
          <Btn variant="ghost" onClick={() => {
            if (!newSubjectName.trim()) return;
            setSetupSubjectRows(rows => [...rows, { original: '', current: newSubjectName.trim() }]);
            setNewSubjectName('');
          }}>+ Add</Btn>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setShowSetupSubjects(false)}>Cancel</Btn>
          <Btn variant="success" onClick={() => {
            const finalSubs = setupSubjectRows.map(r => r.current.trim()).filter(Boolean);

            // Detect renames: rows where the name actually changed
            const renames = setupSubjectRows
              .filter(r => r.original && r.current.trim() && r.original !== r.current.trim())
              .map(r => ({ from: r.original, to: r.current.trim() }));

            setData(d => {
              let next = { ...d, subjectsByClass: { ...(d.subjectsByClass || {}), [selClass]: finalSubs } };
              if (renames.length > 0) {
                // Migrate every exam for this class: for every student, move
                // their score from the old subject key to the new one so
                // nothing is lost when a subject is renamed.
                next = {
                  ...next,
                  exams: (d.exams || []).map(ex => {
                    if (ex.class !== selClass) return ex;
                    const newResults = {};
                    Object.entries(ex.results || {}).forEach(([studentName, subjectScores]) => {
                      const updated = { ...subjectScores };
                      renames.forEach(({ from, to }) => {
                        if (updated[from] !== undefined && updated[to] === undefined) {
                          updated[to] = updated[from];
                          delete updated[from];
                        }
                      });
                      newResults[studentName] = updated;
                    });
                    return { ...ex, results: newResults };
                  }),
                };
              }
              return next;
            });
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
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${examForm.name === n && !examForm.customName ? '#4f8ef7' : 'var(--border)'}`, background: examForm.name === n && !examForm.customName ? '#4f8ef720' : 'var(--surface2)', color: examForm.name === n && !examForm.customName ? '#4f8ef7' : 'var(--text-sub)', fontSize: 12, cursor: 'pointer' }}>
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Final name: <strong style={{ color: 'var(--text)' }}>{examForm.customName || examForm.name || '(none selected)'}</strong>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
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
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>This class has streams — select which streams this exam covers:</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}>
                          <input type="checkbox"
                            checked={examForm.selectedStreams.length === siblings.length}
                            onChange={e => setExamForm(f => ({ ...f, selectedStreams: e.target.checked ? [...siblings] : [f.class] }))}
                          /> All Streams
                        </label>
                        {siblings.map(s => (
                          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}>
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
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${examForm.name === n && !examForm.customName ? '#4f8ef7' : 'var(--border)'}`, background: examForm.name === n && !examForm.customName ? '#4f8ef720' : 'var(--surface2)', color: examForm.name === n && !examForm.customName ? '#4f8ef7' : 'var(--text-sub)', fontSize: 12, cursor: 'pointer' }}>
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
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh', marginBottom: 16 }}>
          <table style={{ ...TS.table, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={{ ...TS.th, position: 'sticky', left: 0, zIndex: 20, background: 'var(--table-header-bg, #1e40af)', minWidth: 140 }}>Student</th>
                {enterSubjects.map(s => <th key={s} style={{ ...TS.th, whiteSpace: 'nowrap', minWidth: 70 }}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {classStudents.map((st, idx) => (
                <tr key={st.id} style={{ background: idx % 2 === 0 ? 'var(--surface)' : 'var(--table-row-alt)' }}>
                  <td style={{ ...TS.td, fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'inherit', zIndex: 5, borderRight: '2px solid var(--border)', minWidth: 140 }}>{st.name}</td>
                  {enterSubjects.map(sub => (
                    <td key={sub} style={{ ...TS.td, padding: '4px 6px', textAlign: 'center' }}>
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
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Student:</span> <strong>{editTarget.studentName}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Subject:</span> <strong>{editTarget.subject}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Current Score:</span> <strong style={{ color: '#f59e0b' }}>{editTarget.currentScore}</strong></div>
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
  th:    { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', whiteSpace: 'nowrap' },
  td:    { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)' },
};
