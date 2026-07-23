import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, GradeBadge, Alert, Icon } from './UI';
import { getGrade, GRADES_CBC, canEnterScores, getClassTeacherStaffId, getTeacherSubjects, getAllClasses, getScore, getStreamFromClass, getSiblingStreams, getSubjectsForClass, getExamColumnsForClass, computeColumnScore, isTeachingStaff } from '../data/initialData';
import { printClassList, printReportForm, printAllReportForms, printOverallClassList, computeRankings, printSubjectPerformance } from '../utils/print';
import { deleteJsonRowDirect, applyExamScorePatch, saveSubjectsByClassDirect } from '../supabase';

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
  // Subjects that have real marks in some exam for this class but are NOT
  // in the current Setup Subjects list — e.g. old/legacy names. These are
  // shown separately (not mixed into setupSubjectRows) because they aren't
  // part of the saved subjectsByClass list; each one is deleted directly
  // (purges those marks from every exam for the class) or merged by typing
  // an existing subject's exact name.
  const [legacySubjects, setLegacySubjects] = useState([]); // [{ name, count }]
  const [legacyMergeInput, setLegacyMergeInput] = useState({}); // { [legacyName]: targetSubjectName }
  const classSubjects = getSubjectsForClass(selClass, data);
  // Assign Teachers modal — lets the principal say who enters marks for
  // each SUBJECT AS DEFINED IN SETUP SUBJECTS (the exam list), instead of
  // having to go to Teachers and type the exact subject name from memory.
  const [showAssignTeachers, setShowAssignTeachers] = useState(false);
  const [staleReassignInput, setStaleReassignInput] = useState({}); // { [teacherId__subject]: targetSubjectName }
  const [selExamId, setSelExamId] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const [showEditReq, setShowEditReq] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editNewScore, setEditNewScore] = useState('');
  // Editing a GROUP column (e.g. "English" = Grammar + Composition summed)
  // means editing each underlying component subject's score individually —
  // there's no single number to overwrite. Principal-only, direct-apply,
  // same as single-subject principal edits.
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupTarget, setEditGroupTarget] = useState(null); // { studentName, examId, column, values }

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

  // Exam columns for VIEWING an exam's results.
  // Base columns always reflect the live Setup Subjects list for selClass —
  // adding or renaming a subject in Setup Subjects takes effect on every
  // exam for this class immediately, past, present, and future.
  //
  // On top of that, we also surface any subject that already has real
  // marks recorded in THIS specific exam, even if it's not (or no longer)
  // in Setup Subjects. This is important: a subject's key can end up out
  // of sync with Setup Subjects for legitimate reasons — e.g. marks were
  // entered under an old/legacy name before Setup Subjects was tidied up,
  // or a subject was renamed without going through the migration in the
  // Setup Subjects editor. Hiding those columns would make real, already-
  // recorded scores invisible even though they still count toward the
  // student's total and mean — exactly the kind of "my marks disappeared"
  // problem this is guarding against.
  //
  // IMPORTANT: this extra-columns behavior is scoped ONLY to this view.
  // It does NOT feed back into the Setup Subjects editor's row list (see
  // the "📚 Setup Subjects" button below) and does NOT get re-saved into
  // subjectsByClass automatically — so a subject you deliberately remove
  // via Setup Subjects still won't reappear there or in future new exams.
  // It will simply keep showing here for any past exam where it genuinely
  // has marks, until those marks are cleared.
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
  async function saveScores() {
    const patches = [];
    classStudents.forEach(st => {
      enterSubjects.forEach(sub => {
        const v = Number(scores[st.name]?.[sub]);
        if (!isNaN(v) && scores[st.name]?.[sub] !== '') {
          patches.push({ studentName: st.name, subject: sub, score: v, submittedBy: user.staffId, locked: false });
        }
      });
    });
    const ctStaffId = getClassTeacherStaffId(selClass, data);
    const notif = (ctStaffId && ctStaffId !== user.staffId)
      ? [{ id: Date.now(), to: ctStaffId, from: user.name, message: `${user.name} submitted scores for ${enterableSubjects.join(', ')} — ${selClass} · ${enterExam.name}`, date: new Date().toISOString().split('T')[0], read: false }]
      : [];
    setShowEnter(false);
    if (patches.length === 0) return;
    try {
      // Save directly, merged against the exam's current database state —
      // not this tab's full local copy — so it can never wipe out another
      // teacher's marks for a different subject entered moments earlier.
      const merged = await applyExamScorePatch(data._schoolId, enterExam.id, patches);
      setData(d => ({
        ...d,
        exams: d.exams.map(ex => ex.id === enterExam.id ? { ...ex, results: merged.results } : ex),
        notifications: [...(d.notifications || []), ...notif],
      }));
    } catch (e) {
      console.error('Save scores failed:', e);
      alert('Could not save — check your connection and try again.');
    }
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
    // Only block "no-op" edits for the approval-request flow — a principal's
    // direct edit is harmless even if re-entering the same number, and
    // blocking it here was an unnecessary restriction on the admin.
    if (!isPrincipal && newScore === editTarget.currentScore) { alert('New score is the same as current score.'); return; }

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

  /* ── Remove a mark entirely (principal only, direct — no approval,
     no restriction) ───────────────────────────────────────────── */
  function clearScore(studentName, subject, examId) {
    if (!isPrincipal) return;
    if (!window.confirm(`Remove the ${subject} score for ${studentName}? This cannot be undone.`)) return;
    setData(d => ({
      ...d,
      exams: d.exams.map(ex => {
        if (ex.id !== examId) return ex;
        const newResults = { ...ex.results };
        if (newResults[studentName]) {
          const updated = { ...newResults[studentName] };
          delete updated[subject];
          newResults[studentName] = updated;
        }
        return { ...ex, results: newResults };
      }),
    }));
    if (flushSave) setTimeout(() => flushSave(), 50);
  }

  /* ── Edit a GROUP column (e.g. "English" = Grammar + Composition) ──
     There's no single number to overwrite — edit each component subject's
     score directly. Principal-only, direct-apply, no approval workflow. */
  function openGroupEdit(studentName, col, examId) {
    if (!isPrincipal) return;
    const exam = data.exams.find(e => e.id === examId);
    const res  = exam?.results?.[studentName] || {};
    const values = {};
    col.components.forEach(c => { values[c] = getScore(res[c]) ?? ''; });
    setEditGroupTarget({ studentName, examId, column: col, values });
    setShowEditGroup(true);
  }

  function saveGroupEdit() {
    const { studentName, examId, column, values } = editGroupTarget;
    for (const c of column.components) {
      const v = values[c];
      if (v !== '' && v !== null && v !== undefined && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100)) {
        alert(`Invalid score for ${c} — must be 0–100 (or left blank to remove it).`);
        return;
      }
    }
    setData(d => ({
      ...d,
      exams: d.exams.map(ex => {
        if (ex.id !== examId) return ex;
        const newResults = { ...ex.results };
        const studentResults = { ...(newResults[studentName] || {}) };
        column.components.forEach(c => {
          const v = values[c];
          if (v === '' || v === null || v === undefined) {
            delete studentResults[c];
          } else {
            studentResults[c] = { score: Number(v), submittedBy: user.staffId, locked: false, editedByPrincipal: true };
          }
        });
        newResults[studentName] = studentResults;
        return { ...ex, results: newResults };
      }),
    }));
    setShowEditGroup(false);
    if (flushSave) setTimeout(() => flushSave(), 50);
  }

  /* ── Legacy subjects (marks exist, not in Setup Subjects list) ────
     These aren't part of setupSubjectRows because they're not saved in
     subjectsByClass — they're orphaned keys sitting in old exam.results.
     Give the admin a real way to get rid of them: delete outright, or
     merge into an existing subject name (moves the marks, doesn't just
     hide them). ─────────────────────────────────────────────────── */
  function purgeLegacySubject(name) {
    if (!window.confirm(`Permanently delete all "${name}" marks recorded for ${selClass}? This removes those scores from every exam where they appear and cannot be undone.`)) return;
    setData(d => ({
      ...d,
      exams: d.exams.map(ex => {
        if (ex.class !== selClass) return ex;
        const newResults = {};
        Object.entries(ex.results || {}).forEach(([studentName, subjectScores]) => {
          const updated = { ...subjectScores };
          delete updated[name];
          newResults[studentName] = updated;
        });
        return { ...ex, results: newResults };
      }),
      teachers: retargetTeacherAssignments(d.teachers || [], selClass, name, null),
    }));
    setLegacySubjects(rows => rows.filter(r => r.name !== name));
    if (flushSave) setTimeout(() => flushSave(), 50);
  }

  function mergeLegacySubject(name) {
    const target = (legacyMergeInput[name] || '').trim();
    if (!target) { alert('Type the exact name of the subject to merge into.'); return; }
    setData(d => ({
      ...d,
      exams: d.exams.map(ex => {
        if (ex.class !== selClass) return ex;
        const newResults = {};
        Object.entries(ex.results || {}).forEach(([studentName, subjectScores]) => {
          const updated = { ...subjectScores };
          if (updated[name] !== undefined) {
            if (updated[target] === undefined) {
              updated[target] = updated[name];
            }
            delete updated[name];
          }
          newResults[studentName] = updated;
        });
        return { ...ex, results: newResults };
      }),
      teachers: retargetTeacherAssignments(d.teachers || [], selClass, name, target),
    }));
    setLegacySubjects(rows => rows.filter(r => r.name !== name));
    setLegacyMergeInput(m => { const n = { ...m }; delete n[name]; return n; });
    if (flushSave) setTimeout(() => flushSave(), 50);
  }

  /* ── Teacher ↔ Subject assignment for MARKS ENTRY (SETUP SUBJECTS is ──
     the source of truth for exams/marks-entry). This writes to a field
     — markEntrySubjects — that is DELIBERATELY SEPARATE from `subjects`
     (the subjects a teacher is assigned to TEACH, set on the Teachers
     screen/Settings). Being assigned to teach a subject does NOT by
     itself let a teacher enter marks for it — only an assignment made
     here does. This solves two problems:
     1. Assigning a teacher for MARKS ENTRY has to reference the exact
        current Setup Subjects name — but before this screen existed,
        admins had no dedicated place to do that and had to retype the
        exact name from memory and easily got it wrong.
     2. When a subject IS renamed/merged here, any teacher previously
        assigned to the old name for marks entry silently loses access —
        this is exactly the "only admin can enter marks" complaint. */

  // Move every teacher's MARKS-ENTRY assignment for `fromName` in `cls`
  // over to `toName` (merging into an existing row for toName if there
  // is one). toName === null means "remove the assignment entirely"
  // (subject deleted).
  function retargetTeacherAssignments(teachers, cls, fromName, toName) {
    return teachers.map(t => {
      const rows = t.markEntrySubjects || [];
      const idx = rows.findIndex(r => r.subject === fromName && (r.classes || []).includes(cls));
      if (idx === -1) return t;
      let newRows = rows
        .map((r, i) => i === idx ? { ...r, classes: r.classes.filter(c => c !== cls) } : r)
        .filter(r => r.classes.length > 0);
      if (toName) {
        const targetIdx = newRows.findIndex(r => r.subject === toName);
        if (targetIdx !== -1) {
          newRows = newRows.map((r, i) => i === targetIdx
            ? { ...r, classes: r.classes.includes(cls) ? r.classes : [...r.classes, cls] }
            : r);
        } else {
          newRows = [...newRows, { subject: toName, classes: [cls] }];
        }
      }
      return { ...t, markEntrySubjects: newRows };
    });
  }

  // Toggle one teacher's marks-entry assignment for one Setup Subject in selClass.
  function toggleTeacherSubjectAssignment(teacherId, subjectName) {
    setData(d => ({
      ...d,
      teachers: (d.teachers || []).map(t => {
        if (t.id !== teacherId) return t;
        const rows = t.markEntrySubjects || [];
        const idx = rows.findIndex(r => r.subject === subjectName);
        if (idx === -1) {
          return { ...t, markEntrySubjects: [...rows, { subject: subjectName, classes: [selClass] }] };
        }
        const alreadyIn = (rows[idx].classes || []).includes(selClass);
        const newRows = rows.map((r, i) => {
          if (i !== idx) return r;
          const classes = alreadyIn ? r.classes.filter(c => c !== selClass) : [...r.classes, selClass];
          return { ...r, classes };
        }).filter(r => r.classes.length > 0);
        return { ...t, markEntrySubjects: newRows };
      }),
    }));
    if (flushSave) setTimeout(() => flushSave(), 50);
  }

  // Teacher marks-entry rows for selClass whose subject name is NOT in
  // the current Setup Subjects list — leftovers from renames/merges done
  // before this screen existed. Surfaced so the admin can fix them
  // instead of silently losing marks-entry access.
  function getStaleTeacherAssignments() {
    const current = new Set(getSubjectsForClass(selClass, data));
    const out = [];
    (data.teachers || []).forEach(t => {
      (t.markEntrySubjects || []).forEach(r => {
        if ((r.classes || []).includes(selClass) && !current.has(r.subject)) {
          out.push({ teacherId: t.id, teacherName: t.name, subject: r.subject });
        }
      });
    });
    return out;
  }

  function fixStaleAssignment(teacherId, subject) {
    const key = `${teacherId}__${subject}`;
    const target = (staleReassignInput[key] || '').trim();
    if (!target) { alert('Choose the current subject to reassign this to.'); return; }
    // Scoped to just this teacher's row — so fixing one person's stale
    // assignment can't accidentally touch another teacher who happens to
    // share the same old subject name for a different reason.
    setData(d => ({
      ...d,
      teachers: (d.teachers || []).map(t => {
        if (t.id !== teacherId) return t;
        return retargetTeacherAssignments([t], selClass, subject, target)[0];
      }),
    }));
    setStaleReassignInput(m => { const n = { ...m }; delete n[key]; return n; });
    if (flushSave) setTimeout(() => flushSave(), 50);
  }

  function removeStaleAssignment(teacherId, subject) {
    setData(d => ({
      ...d,
      teachers: (d.teachers || []).map(t => {
        if (t.id !== teacherId) return t;
        return retargetTeacherAssignments([t], selClass, subject, null)[0];
      }),
    }));
    if (flushSave) setTimeout(() => flushSave(), 50);
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
                if (data._schoolId) {
                  deleteJsonRowDirect('exams', data._schoolId, selExam.id).catch(e => {
                    console.error('Delete failed:', e);
                    alert('Could not delete — check your connection and try again.');
                  });
                }
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
                if (data._schoolId) {
                  orphaned.forEach(ex => {
                    deleteJsonRowDirect('exams', data._schoolId, ex.id).catch(e => console.error('Delete failed:', e));
                  });
                }
                alert('Orphaned exam records removed.');
              }
            }}>
              🧹 Clean Orphaned Exams
            </Btn>
          )}
          {isPrincipal && (
            <Btn variant="ghost" onClick={() => {
              // Main editable list: the CURRENT Setup Subjects only. We
              // deliberately don't merge in every subject that has ever had
              // marks recorded — that used to make subjects you'd just
              // removed pop right back into this list (and then get
              // re-saved by accident), which is the opposite of "remove".
              const settingsSubs = getSubjectsForClass(selClass, data) || [];
              setSetupSubjectRows(settingsSubs.map(s => ({ original: s, current: s })));

              // Separately: any subject with real marks somewhere in this
              // class's exams that ISN'T in the current list — legacy/
              // out-of-sync names. Surfaced on their own so the admin can
              // actually see and manage them (delete outright, or merge
              // into an existing subject by renaming) instead of them being
              // invisible everywhere.
              const settingsSet = new Set(settingsSubs);
              const markCounts = {};
              (data.exams || [])
                .filter(e => e.class === selClass)
                .forEach(e => {
                  Object.values(e.results || {}).forEach(r => {
                    Object.keys(r).forEach(k => {
                      if (!settingsSet.has(k)) markCounts[k] = (markCounts[k] || 0) + 1;
                    });
                  });
                });
              setLegacySubjects(Object.keys(markCounts).map(name => ({ name, count: markCounts[name] })));

              setNewSubjectName('');
              setShowSetupSubjects(true);
            }}>
              📚 Setup Subjects
            </Btn>
          )}
          {isPrincipal && (
            <Btn variant="ghost" onClick={() => setShowAssignTeachers(true)}>
              👤 Assign Teachers
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
          <div style={{ overflowX: 'auto' }}>
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
                      const canEditSingle = col.type === 'single' && canRequestEdit(col.subject || col.name, selExam);
                      const canEditGroup  = col.type === 'group' && isPrincipal;
                      return (
                        <td key={colName} style={{ ...TS.td, textAlign: 'center', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                            <span title={col.type === 'group' ? col.components.map(c => `${c}: ${getScore(s.results[c]) ?? '—'}`).join(', ') : ''}
                              style={{ color: col.type === 'group' ? '#4f8ef7' : 'inherit', fontWeight: col.type === 'group' ? 700 : 'inherit' }}>
                              {score ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </span>
                            {score !== null && canEditSingle && (
                              <button onClick={() => openEditRequest(s.name, col.subject || col.name, score, selExam.id)}
                                title="Edit score"
                                style={{ background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 11, padding: '1px 4px', borderRadius: 4, opacity: 0.7 }}>✎</button>
                            )}
                            {canEditGroup && (
                              <button onClick={() => openGroupEdit(s.name, col, selExam.id)}
                                title="Edit combined subject components"
                                style={{ background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 11, padding: '1px 4px', borderRadius: 4, opacity: 0.7 }}>✎</button>
                            )}
                            {score !== null && col.type === 'single' && isPrincipal && (
                              <button onClick={() => clearScore(s.name, col.subject || col.name, selExam.id)}
                                title="Remove this score"
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: '1px 4px', borderRadius: 4, opacity: 0.7 }}>✕</button>
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
          This is the exam subject list for <strong>{selClass}</strong> — controls what shows when entering new marks. Rename a subject and marks move with it automatically.
          <strong style={{ color: '#f59e0b' }}> Removing a subject here takes it out of this list for good (it won't come back on its own) — but if it already has marks in a past exam, those marks stay visible when viewing that exam's results, they just won't be offered again for new entry.</strong>
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

        {legacySubjects.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#f59e0b', marginBottom: 4 }}>
              ⚠ Legacy subjects with marks — not in the list above ({legacySubjects.length})
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              These have real recorded marks under a name that isn't in your current subject list — likely old/renamed subjects. Delete to permanently remove those marks, or merge them into an existing subject name to keep the scores.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {legacySubjects.map(({ name, count }) => (
                <div key={name} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <strong>{name}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{count} score{count === 1 ? '' : 's'} recorded</span>
                    </div>
                    <Btn size="sm" variant="danger" onClick={() => purgeLegacySubject(name)}>
                      <Icon name="trash" size={12} /> Delete
                    </Btn>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={legacyMergeInput[name] || ''}
                      onChange={e => setLegacyMergeInput(m => ({ ...m, [name]: e.target.value }))}
                      placeholder={`Merge into… e.g. "${setupSubjectRows[0]?.current || 'Kiswahili Language'}"`}
                      style={{ flex: 1, fontSize: 12 }}
                    />
                    <Btn size="sm" variant="ghost" onClick={() => mergeLegacySubject(name)}>Merge</Btn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setShowSetupSubjects(false)}>Cancel</Btn>
          <Btn variant="success" onClick={async () => {
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
                // Also move any teacher's marks-entry assignment from the old
                // subject name to the new one, so renaming/combining a
                // subject here doesn't silently strip a teacher's access —
                // the exact confusion that made admins enter all the marks
                // themselves.
                let teachersNext = d.teachers || [];
                renames.forEach(({ from, to }) => {
                  teachersNext = retargetTeacherAssignments(teachersNext, selClass, from, to);
                });
                next = { ...next, teachers: teachersNext };
              }
              return next;
            });
            // Save this class's subject list directly to the database right
            // now — merged against whatever's currently there for OTHER
            // classes — instead of waiting on the general debounced save,
            // which pushes this whole browser tab's copy of every class's
            // subjects and can silently undo a change another tab made to a
            // different class in the meantime. This is what was making
            // Setup Subjects "disappear" after logout/login.
            if (data._schoolId) {
              try {
                await saveSubjectsByClassDirect(data._schoolId, selClass, finalSubs);
              } catch (e) {
                console.error('Save failed:', e);
                alert('Could not save — check your connection and try again. Your changes are still shown here but may not have been saved.');
              }
            }
            setShowSetupSubjects(false);
          }}>Save Subjects</Btn>
        </div>
      </Modal>

      {/* Assign Teachers Modal — assigns marks-entry access using the ──
          CURRENT Setup Subjects names for selClass, so there's no risk of
          typing a subject name that's since been renamed or merged. */}
      <Modal show={showAssignTeachers} onClose={() => setShowAssignTeachers(false)} title={`Assign Teachers — ${selClass}`} wide>
        <Alert type="info">
          Tick a teacher next to a subject to let them enter marks for it in <strong>{selClass}</strong>. This list always matches the current Setup Subjects — it's the same list used when a teacher enters marks for an exam.
          <br/><strong>This is separate from the subjects assigned on the Teachers screen</strong> (which are for teaching/timetable only). Being assigned to teach a subject does <strong>not</strong> by itself let a teacher enter marks for it — only ticking them here does.
        </Alert>

        {(() => {
          const currentSubjects = getSubjectsForClass(selClass, data);
          const teachingStaff = (data.teachers || []).filter(isTeachingStaff);
          if (currentSubjects.length === 0) {
            return <Alert type="warning">No subjects set up for {selClass} yet — add them in 📚 Setup Subjects first.</Alert>;
          }
          if (teachingStaff.length === 0) {
            return <Alert type="warning">No teaching staff found yet — add teachers first.</Alert>;
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {currentSubjects.map(sub => {
                const assignedIds = new Set(
                  teachingStaff
                    .filter(t => (t.markEntrySubjects || []).some(r => r.subject === sub && (r.classes || []).includes(selClass)))
                    .map(t => t.id)
                );
                return (
                  <div key={sub} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{sub}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {teachingStaff.map(t => (
                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', background: assignedIds.has(t.id) ? 'var(--accent)15' : 'transparent', padding: '4px 8px', borderRadius: 6 }}>
                          <input
                            type="checkbox"
                            checked={assignedIds.has(t.id)}
                            onChange={() => toggleTeacherSubjectAssignment(t.id, sub)}
                          />
                          {t.name}{t.canEnterAllMarks ? ' (all subjects)' : ''}
                        </label>
                      ))}
                    </div>
                    {assignedIds.size === 0 && (
                      <div style={{ fontSize: 11.5, color: '#f59e0b', marginTop: 6 }}>
                        ⚠ No teacher assigned — only the principal/class teacher can enter marks for this subject.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {(() => {
          const stale = getStaleTeacherAssignments();
          const currentSubjects = getSubjectsForClass(selClass, data);
          if (stale.length === 0) return null;
          return (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#f59e0b', marginBottom: 4 }}>
                ⚠ Assignments pointing at old subject names ({stale.length})
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                These teachers are assigned to a subject name that no longer exists in Setup Subjects for {selClass} — likely from before a rename or merge. They currently can't enter marks under the new name. Point each one at the correct current subject, or remove it.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stale.map(({ teacherId, teacherName, subject }) => {
                  const key = `${teacherId}__${subject}`;
                  return (
                    <div key={key} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ marginBottom: 8 }}>
                        <strong>{teacherName}</strong> → <span style={{ color: '#f59e0b' }}>{subject}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={staleReassignInput[key] || ''}
                          onChange={e => setStaleReassignInput(m => ({ ...m, [key]: e.target.value }))}
                          style={{ flex: 1, fontSize: 12 }}
                        >
                          <option value="">— Reassign to current subject —</option>
                          {currentSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Btn size="sm" variant="ghost" onClick={() => fixStaleAssignment(teacherId, subject)}>Fix</Btn>
                        <Btn size="sm" variant="danger" onClick={() => removeStaleAssignment(teacherId, subject)}>Remove</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setShowAssignTeachers(false)}>Close</Btn>
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
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
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
      <Modal show={showEditReq} onClose={() => setShowEditReq(false)} title={isPrincipal ? 'Edit Score' : 'Request Score Edit'}>
        {isPrincipal ? (
          <Alert type="info">
            <Icon name="alert" size={14} />
            As principal, changes apply immediately — no approval needed.
          </Alert>
        ) : (
          <Alert type="warning">
            <Icon name="alert" size={14} />
            Editing a submitted score requires approval from the class teacher AND the principal. All parties will be notified.
          </Alert>
        )}
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
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          {isPrincipal && editTarget && (
            <Btn variant="danger" onClick={() => {
              setShowEditReq(false);
              clearScore(editTarget.studentName, editTarget.subject, editTarget.examId);
            }}>Remove Score</Btn>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Btn variant="ghost" onClick={() => setShowEditReq(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={submitEditRequest} disabled={!editNewScore}>{isPrincipal ? 'Save' : 'Submit Edit Request'}</Btn>
          </div>
        </div>
      </Modal>

      {/* Edit Group (combined/overall subject) Modal — principal only */}
      <Modal show={showEditGroup} onClose={() => setShowEditGroup(false)} title={`Edit ${editGroupTarget?.column?.name || ''} — ${editGroupTarget?.studentName || ''}`}>
        <Alert type="info">
          <Icon name="alert" size={14} />
          This is a combined subject made up of several components. Edit each one directly — changes apply immediately. Leave a field blank to remove that component's score.
        </Alert>
        {editGroupTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {editGroupTarget.column.components.map(c => (
              <FormGroup key={c} label={c}>
                <input
                  type="number" min={0} max={100}
                  value={editGroupTarget.values[c]}
                  onChange={e => setEditGroupTarget(t => ({ ...t, values: { ...t.values, [c]: e.target.value } }))}
                  placeholder="—"
                />
              </FormGroup>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setShowEditGroup(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={saveGroupEdit}>Save</Btn>
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
