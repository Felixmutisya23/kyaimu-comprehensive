import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, Alert, ProgressBar, Avatar, GradeBadge, Icon } from './UI';
import { getGrade, getAllClasses, getScore, getStreamFromClass, generateSLC, generateAdmNo, buildStudentName } from '../data/initialData';
import { deleteStudentDirect } from '../supabase';
import { getTotalExpected, getPaid } from './FeesModule';
import * as XLSX from 'xlsx';
import { printLeavingCert, printReportForm, printStudentIntakeForm, printStudentRegister } from '../utils/print';

function curTermYear() {
  const m = new Date().getMonth();
  const term = m < 4 ? '1' : m < 8 ? '2' : '3';
  return { term, year: new Date().getFullYear() };
}

export default function Students({ data, setData, user, isUnlocked = true , isDark, themeVars }) {
  const _bg = themeVars ? themeVars['--bg'] : 'var(--bg)';
  const _surface = themeVars ? themeVars['--surface'] : 'var(--surface)';
  const _text = themeVars ? themeVars['--text'] : 'var(--text)';

  const isPrincipal    = user.role === 'principal';
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;
  // A dedicated "Registrar"-type staff member can be granted this flag
  // (Teachers screen) to add/edit students across ALL classes without
  // being the principal or a class teacher. Deleting a student record is
  // deliberately still principal-only.
  const canManageAllStudents = isPrincipal || !!user.canManageStudents;
  // Every teacher — not just Registrar — can add/edit students in classes
  // they're directly responsible for: their own class (if class teacher)
  // and any class they're assigned to enter marks for. This is deliberately
  // narrower than canManageAllStudents (no access to classes they have no
  // connection to), and never includes delete.
  const myOwnClasses = [...new Set([
    ...(isClassTeacher && myClass ? [myClass] : []),
    ...((user.markEntrySubjects || []).flatMap(s => s.classes || [])),
  ])];
  const canManageOwnClasses = !canManageAllStudents && myOwnClasses.length > 0;

  const admMode = data.admissionSetting || 'manual';
  // manual = Type A: required, admin types
  // auto   = Type B: system assigns, field hidden
  // mixed  = Type C: optional, system fills blank with hidden internalId

  function getVisibleStudents(search, filterClass) {
    let students = data.students;
    if (!canManageAllStudents) {
      if (isClassTeacher) students = students.filter(s => s.class === myClass);
      else {
        const myClasses = [...new Set([...(user.teacherSubjects || []).flatMap(s => s.classes), ...myOwnClasses])];
        students = students.filter(s => myClasses.includes(s.class));
      }
    }
    if (filterClass) students = students.filter(s => s.class === filterClass);
    if (search) students = students.filter(s =>
      (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.admNo || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.slc   || '').includes(search)
    );
    // Always sort alphabetically by name
    return [...students].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  const [show, setShow]               = useState(false);
  const [viewStudent, setViewStudent] = useState(null);
  const [search, setSearch]           = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [caseText, setCaseText]       = useState('');
  const [form, setForm]               = useState(initForm());

  function initForm() {
    const cls = myClass || getAllClasses(data)[0] || '';
    return {
      firstName: '', lastName: '', otherName: '',
      admNo: '', class: cls,
      dob: '', parentName: '', parentPhone: '', parentEmail: '',
      joined: new Date().getFullYear().toString(),
    };
  }

  // ── Bulk upload state ──────────────────────────────────────
  const [showUpload,    setShowUpload]    = useState(false);
  const [uploadRows,    setUploadRows]    = useState([]); // parsed rows
  const [uploadErrors,  setUploadErrors]  = useState([]); // row errors
  const [uploadDone,    setUploadDone]    = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null); // { added, skipped }

  /* Download Excel template */
  function downloadTemplate() {
    const admMode = data.admissionSetting || 'manual';
    const headers = admMode === 'auto'
      ? ['First Name','Last Name','Other Name','Class','Date of Birth (DD/MM/YYYY)','Parent Name','Parent Phone','Year Joined']
      : ['First Name','Last Name','Other Name','Admission Number','Class','Date of Birth (DD/MM/YYYY)','Parent Name','Parent Phone','Year Joined'];

    const example = admMode === 'auto'
      ? ['Kamau','Njoroge','Mwangi','Grade 7 A','01/01/2012','Jane Njoroge','0712345678','2024']
      : ['Kamau','Njoroge','Mwangi','KPS/001/2024','Grade 7 A','01/01/2012','Jane Njoroge','0712345678','2024'];

    const ws   = XLSX.utils.aoa_to_sheet([headers, example]);
    // Set column widths
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student_upload_template.xlsx');
  }

  /* Parse uploaded Excel/CSV file */
  function handleUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErrors([]);
    setUploadRows([]);
    setUploadDone(false);
    setUploadSummary(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'binary', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) { setUploadErrors(['File is empty or has no data rows.']); return; }

        const headers = (rows[0] || []).map(h => String(h).trim().toLowerCase());
        const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim()));

        // Map header names flexibly
        function col(row, ...names) {
          for (const name of names) {
            const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
            if (idx >= 0 && row[idx] !== undefined) return String(row[idx]).trim();
          }
          return '';
        }

        const parsed = dataRows.map((row, i) => ({
          rowNum:      i + 2,
          firstName:   col(row, 'first name', 'firstname', 'first'),
          lastName:    col(row, 'last name', 'lastname', 'last'),
          otherName:   col(row, 'other', 'middle', 'clan'),
          admNo:       col(row, 'admission', 'adm'),
          class:       col(row, 'class', 'grade', 'form'),
          dob:         col(row, 'birth', 'dob', 'date of birth'),
          parentName:  col(row, 'parent name', 'guardian name', 'parent'),
          parentPhone: col(row, 'phone', 'mobile', 'contact'),
          joined:      col(row, 'year joined', 'joined', 'year'),
        }));

        setUploadRows(parsed);
      } catch(err) {
        setUploadErrors(['Could not read file: ' + err.message]);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  /* Import all valid rows */
  function importRows() {
    const admMode  = data.admissionSetting || 'manual';
    const allCls   = getAllClasses(data);
    const errors   = [];
    const toAdd    = [];
    let   students = [...data.students];

    uploadRows.forEach((row, i) => {
      // Validate required fields
      if (!row.firstName && !row.lastName) {
        errors.push(`Row ${row.rowNum}: Missing first and last name — skipped.`);
        return;
      }
      if (!row.class) {
        errors.push(`Row ${row.rowNum}: Missing class — skipped.`);
        return;
      }
      // Validate class exists
      const matchedClass = allCls.find(c => c.toLowerCase() === row.class.toLowerCase());
      if (!matchedClass) {
        errors.push(`Row ${row.rowNum}: Class "${row.class}" not found in school. Check spelling — skipped.`);
        return;
      }
      // Admission number logic
      let admNo = '';
      let internalId = '';
      if (admMode === 'manual') {
        if (!row.admNo) { errors.push(`Row ${row.rowNum}: Admission number required — skipped.`); return; }
        admNo = row.admNo;
      } else if (admMode === 'auto') {
        admNo = generateAdmNo(data, [...students, ...toAdd.map(s => ({ admNo: s.admNo }))]);
      } else {
        if (row.admNo) admNo = row.admNo;
        else internalId = `INT-${Date.now()}-${i}-${Math.random().toString(36).slice(2,7)}`;
      }

      // Check duplicate (same name + class)
      const fullName = buildStudentName(row.firstName, row.lastName, row.otherName);
      const dup = students.find(s => s.name?.toLowerCase() === fullName.toLowerCase() && s.class?.toLowerCase() === matchedClass.toLowerCase());
      if (dup) { errors.push(`Row ${row.rowNum}: "${fullName}" in ${matchedClass} already exists — skipped.`); return; }

      const slc = generateSLC([...students, ...toAdd]);
      const stream = getStreamFromClass(matchedClass, data) || '';

      toAdd.push({
        id:          Date.now() + i + Math.random(),
        firstName:   row.firstName,
        lastName:    row.lastName,
        otherName:   row.otherName,
        name:        fullName,
        admNo,
        internalId,
        slc,
        class:       matchedClass,
        stream,
        dob:         row.dob,
        parentName:  row.parentName,
        parentPhone: row.parentPhone,
        parentEmail: '',
        joined:      row.joined || String(new Date().getFullYear()),
        fees:        { paid: 0, total: 0 },
        cases:       [],
      });
    });

    if (toAdd.length > 0) {
      setData(d => ({ ...d, students: [...d.students, ...toAdd] }));
    }
    setUploadErrors(errors);
    setUploadSummary({ added: toAdd.length, skipped: errors.length });
    setUploadDone(true);
    setUploadRows([]);
  }

  const canAdd         = canManageAllStudents || isClassTeacher || canManageOwnClasses;
  const addableClasses = canManageAllStudents ? getAllClasses(data) : isClassTeacher ? [myClass] : myOwnClasses;

  function save() {
    if (!form.firstName.trim() && !form.lastName.trim()) {
      alert('Please enter at least a first name or last name.');
      return;
    }
    if (!canManageAllStudents && !canManageOwnClasses && isClassTeacher && form.class !== myClass) {
      alert(`You can only add students to your class: ${myClass}`);
      return;
    }

    const fullName = buildStudentName(form.firstName.trim(), form.lastName.trim(), form.otherName.trim());
    const stream   = getStreamFromClass(form.class, data) || '';

    // Generate SLC for ALL students regardless of admission type
    const slc = generateSLC(data.students);

    // Admission number logic per type
    let admNo      = '';
    let internalId = '';

    if (admMode === 'manual') {
      if (!form.admNo.trim()) { alert('Admission number is required for this school.'); return; }
      admNo = form.admNo.trim();
    } else if (admMode === 'auto') {
      admNo = generateAdmNo(data, data.students);
    } else {
      // mixed
      if (form.admNo.trim()) {
        admNo = form.admNo.trim();
      } else {
        // Hidden internal ID — never shown
        internalId = `INT-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      }
    }

    const ns = {
      id: Date.now(),
      firstName:  form.firstName.trim(),
      lastName:   form.lastName.trim(),
      otherName:  form.otherName.trim(),
      name:       fullName,
      admNo,
      internalId,
      slc,
      class:      form.class,
      stream,
      dob:        form.dob,
      parentName:  form.parentName.trim(),
      parentPhone: form.parentPhone.trim(),
      parentEmail: form.parentEmail.trim(),
      joined:     form.joined,
      fees:       { paid: 0, total: 0 },
      cases:      [],
    };

    setData(d => ({ ...d, students: [...d.students, ns] }));
    setShow(false);
    setForm(initForm());
  }

  function deleteStudent(id) {
    if (!isPrincipal) { alert('Only the principal can delete student records.'); return; }
    if (window.confirm('Delete this student? This cannot be undone.')) {
      setData(d => ({ ...d, students: d.students.filter(s => s.id !== id) }));
      // Delete directly and immediately — don't rely on the general
      // debounced save to notice this row is "missing", since another
      // browser tab's stale copy could otherwise bring it right back.
      if (data._schoolId) {
        deleteStudentDirect(data._schoolId, id).catch(e => {
          console.error('Delete failed:', e);
          alert('Could not delete — check your connection and try again.');
        });
      }
    }
  }

  // ── Edit student ──────────────────────────────────────
  const [showEdit,   setShowEdit]   = useState(false);
  const [editForm,   setEditForm]   = useState(null);
  const [editId,     setEditId]     = useState(null);

  function openEdit(s) {
    setEditForm({
      firstName:   s.firstName  || s.name?.split(' ')[0] || '',
      lastName:    s.lastName   || s.name?.split(' ').slice(-1)[0] || '',
      otherName:   s.otherName  || '',
      admNo:       s.admNo      || '',
      class:       s.class      || '',
      dob:         s.dob        || '',
      parentName:  s.parentName || s.parent || '',
      parentPhone: s.parentPhone|| s.phone  || '',
      joined:      s.joined     || '',
    });
    setEditId(s.id);
    setShowEdit(true);
  }

  function saveEdit() {
    const fullName = buildStudentName(editForm.firstName.trim(), editForm.lastName.trim(), editForm.otherName.trim());
    setData(d => ({
      ...d,
      students: d.students.map(s => s.id === editId ? {
        ...s,
        firstName:   editForm.firstName.trim(),
        lastName:    editForm.lastName.trim(),
        otherName:   editForm.otherName.trim(),
        name:        fullName,
        admNo:       editForm.admNo,
        class:       editForm.class,
        dob:         editForm.dob,
        parentName:  editForm.parentName.trim(),
        parentPhone: editForm.parentPhone.trim(),
        joined:      editForm.joined,
      } : s),
    }));
    setShowEdit(false);
    setEditId(null);
    setEditForm(null);
  }

  function addCase(s) {
    if (!caseText.trim()) return;
    const entry = `${caseText} — ${new Date().toISOString().split('T')[0]}`;
    setData(d => ({
      ...d,
      students: d.students.map(st => st.id === s.id ? { ...st, cases: [...st.cases, entry] } : st),
    }));
    setViewStudent(prev => ({ ...prev, cases: [...prev.cases, entry] }));
    setCaseText('');
  }

  const filtered       = getVisibleStudents(search, filterClass);
  const allClasses     = getAllClasses(data);
  const visibleClasses = canManageAllStudents ? allClasses
    : isClassTeacher ? [myClass]
    : [...new Set([...(user.teacherSubjects || []).flatMap(s => s.classes), ...myOwnClasses])].filter((v, i, a) => a.indexOf(v) === i);

  /* ── Student detail view ──────────────────────────── */
  if (viewStudent) {
    const s   = data.students.find(x => x.id === viewStudent.id) || viewStudent;
    const pct = s.fees?.total > 0 ? Math.round(s.fees.paid / s.fees.total * 100) : 0;
    const exams     = data.exams.filter(e => e.class === s.class);
    const payments  = (data.feePayments || []).filter(p => p.studentId === s.id);
    const canSeeFees_ = isPrincipal || user.canSeeFees;
    const mySubjects = (user.teacherSubjects || []).map(x => x.subject);

    return (
      <div>
        <Btn variant="ghost" size="sm" onClick={() => setViewStudent(null)} style={{ marginBottom: 16 }}>
          <Icon name="back" size={14} /> Back to Students
        </Btn>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Avatar name={s.name} size={52} color="#1e40af" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {admMode !== 'mixed' || s.admNo ? `Adm: ${s.admNo} · ` : ''}{s.class}
                </div>
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 3 }}>
                  Login Code (SLC): <strong>{s.slc}</strong>
                </div>
              </div>
            </div>
            {[
              ['Parent/Guardian', s.parentName],
              ['Phone', s.parentPhone],
              ['Date of Birth', s.dob],
              ['Year Joined', s.joined],
              ['Current Class', s.class],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                <span style={{ fontWeight: 500 }}>{v || '—'}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {(isPrincipal || isClassTeacher) && (
                <Btn size="sm" onClick={() => printLeavingCert(s, data)}>
                  <Icon name="print" size={13} /> Leaving Cert
                </Btn>
              )}
            </div>
          </Card>

          {canSeeFees_ ? (
            <Card>
              <SectionTitle icon="fees">Fee Account</SectionTitle>
              {!s.fees?.total ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No fee record set. Go to Fees module to assign.</div>
              ) : (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700, color: pct >= 100 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444', marginBottom: 4 }}>
                    KES {s.fees.paid.toLocaleString()}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>of KES {s.fees.total.toLocaleString()} total</div>
                  <ProgressBar pct={pct} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 10 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Balance: KES {(s.fees.total - s.fees.paid).toLocaleString()}</span>
                    <Tag color={pct >= 100 ? 'green' : pct > 50 ? 'amber' : 'red'}>
                      {pct >= 100 ? 'Paid' : pct > 50 ? 'Partial' : 'Arrears'}
                    </Tag>
                  </div>
                </>
              )}
            </Card>
          ) : (
            <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
                Fee information restricted to Finance Office and Principal.
              </div>
            </Card>
          )}
        </div>

        {(isPrincipal || isClassTeacher) && (
          <Card style={{ marginBottom: 16 }}>
            <SectionTitle icon="alert">Disciplinary Cases</SectionTitle>
            {s.cases.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No cases on record. ✓</p>
              : s.cases.map((c, i) => <Alert key={i} type="warning"><Icon name="alert" size={14} />{c}</Alert>)}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={caseText} onChange={e => setCaseText(e.target.value)} placeholder="Log a new case..." style={{ flex: 1 }} />
              <Btn size="sm" onClick={() => addCase(s)} disabled={!caseText.trim()}>Log</Btn>
            </div>
          </Card>
        )}

        <Card>
          <SectionTitle icon="exams">Academic Performance</SectionTitle>
          {exams.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No exam records yet.</p>
            : exams.map(ex => {
              const res = ex.results[s.name];
              if (!res) return null;
              const visibleSubs = Object.keys(res).filter(sub => isPrincipal || isClassTeacher || mySubjects.includes(sub));
              if (!visibleSubs.length) return null;
              const scores = visibleSubs.map(sub => { const cell = res[sub]; return cell?.score ?? cell ?? 0; });
              const total  = scores.reduce((a, b) => a + b, 0);
              const mean   = Math.round(total / scores.length);
              const g      = getGrade(mean);
              return (
                <div key={ex.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{ex.name}</span>
                    {(isPrincipal || isClassTeacher) && <span style={{ color: g.color, fontWeight: 700 }}>Mean: {g.label} ({mean})</span>}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={TS.table}>
                      <thead><tr>{[...visibleSubs,...(isPrincipal||isClassTeacher?['Total','Grade']:[])].map(h=><th key={h} style={TS.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        <tr>
                          {visibleSubs.map(sub => { const cell=res[sub]; const score=cell?.score??cell??'—'; return <td key={sub} style={{...TS.td,textAlign:'center'}}>{score}</td>; })}
                          {(isPrincipal||isClassTeacher)&&<><td style={{...TS.td,fontWeight:700}}>{total}</td><td style={TS.td}><GradeBadge score={mean}/></td></>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {(isPrincipal||isClassTeacher)&&<div style={{marginTop:6,textAlign:'right'}}><Btn size="sm" variant="ghost" onClick={()=>printReportForm(s,ex,data)}><Icon name="print" size={12}/> Print Report</Btn></div>}
                </div>
              );
            })}
        </Card>
      </div>
    );
  }

  /* ── List view ────────────────────────────────────── */
  return (
    <div>
      {isClassTeacher && (
        <Alert type="info"><Icon name="alert" size={14}/>You are viewing <strong>{myClass}</strong>. You can add students to this class only.</Alert>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search name, adm no or login code..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 280 }} />
        {canManageAllStudents && (
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ width: 160 }}>
            <option value="">All Classes</option>
            {visibleClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {canManageAllStudents && (
            <Btn variant="ghost" onClick={() => printStudentIntakeForm(data)}>
              <Icon name="print" size={14} /> Intake Form
            </Btn>
          )}
          {canManageAllStudents && (
            <Btn variant="ghost" onClick={() => {
              const missing = (data.students || []).filter(s => !s.slc);
              if (!missing.length) { alert('All students already have login codes.'); return; }
              setData(d => {
                const existing = new Set(d.students.map(s => s.slc).filter(Boolean));
                const students = d.students.map(s => {
                  if (s.slc) return s;
                  let code;
                  do { code = `${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`; }
                  while (existing.has(code));
                  existing.add(code);
                  return { ...s, slc: code };
                });
                return { ...d, students };
              });
              alert(`Generated login codes for ${missing.length} student${missing.length > 1 ? 's' : ''}.`);
            }} style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
              🔑 Fix Missing Codes ({(data.students || []).filter(s => !s.slc).length})
            </Btn>
          )}
          {(canManageAllStudents || isClassTeacher) && (
            <Btn variant="ghost" onClick={() => {
              const cls = filterClass || myClass || '';
              const studentsForList = cls
                ? filtered.filter(s => s.class === cls)
                : filtered;
              if (!studentsForList.length) { alert('No students to print. Select a class first.'); return; }
              const teacher = cls
                ? (data.teachers||[]).find(t => t.isClassTeacher && t.classTeacherOf === cls)
                : null;
              printStudentRegister(studentsForList, cls || 'All Classes', data, {
                classTeacher: teacher ? teacher.name : (isClassTeacher ? user.name : ''),
                term: data.currentTerm ? `Term ${data.currentTerm}` : '',
                year: data.currentYear || new Date().getFullYear(),
              });
            }}>
              <Icon name="print" size={14} /> Class List
            </Btn>
          )}
          {canManageAllStudents && (
            <Btn variant="ghost" onClick={() => { setShowUpload(true); setUploadRows([]); setUploadErrors([]); setUploadDone(false); setUploadSummary(null); }}>
              <Icon name="upload" size={14} /> Bulk Upload
            </Btn>
          )}
          {canAdd && (
            <Btn onClick={() => { setForm(initForm()); setShow(true); }}>
              <Icon name="add" size={14} /> Add Student
            </Btn>
          )}
        </div>
      </div>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table style={TS.table}>
            <thead>
              <tr>
                {[
                  ...(admMode !== 'auto' ? ['Adm No'] : ['Adm No']),
                  'Name','Class','Login Code',
                  ...(user.canSeeFees||isPrincipal ? ['Fees'] : []),
                  'Cases',''
                ].map(h => <th key={h} style={TS.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const { term: curT, year: curY } = curTermYear();
                const exp = getTotalExpected(s, curT, curY, data);
                const pd  = getPaid(s.id, curT, curY, data);
                const pct = exp > 0 ? Math.round(pd / exp * 100) : 0;
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={TS.td}>
                      {s.admNo
                        ? <span style={{ background: '#1d4ed820', color: '#60a5fa', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{s.admNo}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ ...TS.td, fontWeight: 700, fontSize: 13, color: 'var(--text)', letterSpacing: 0.3 }}>
                      {(s.name || '').toUpperCase()}
                    </td>
                    <td style={{ ...TS.td, fontSize: 12 }}>
                      <span style={{ background: '#7c3aed20', color: '#a78bfa', padding: '2px 8px', borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                        {s.class || '—'}
                      </span>
                    </td>
                    <td style={TS.td}>
                      {s.slc
                        ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#10b981', fontWeight: 700, background: '#10b98115', padding: '2px 8px', borderRadius: 6 }}>{s.slc}</span>
                        : <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, background: '#f59e0b15', padding: '2px 8px', borderRadius: 6 }}>⚠ No Code</span>}
                    </td>
                    {(user.canSeeFees || isPrincipal) && (
                      <td style={TS.td}>
                        {exp > 0
                          ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <ProgressBar pct={pct} />
                              <span style={{ fontSize: 11, color: pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{pct}%</span>
                            </div>
                          : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Not set</span>}
                      </td>
                    )}
                    <td style={TS.td}>
                      {s.cases?.length > 0
                        ? <span style={{ background: '#ef444420', color: '#ef4444', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{s.cases.length} Case{s.cases.length > 1 ? 's' : ''}</span>
                        : <span style={{ background: '#10b98115', color: '#10b981', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Clear</span>}
                    </td>
                    <td style={TS.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn size="sm" variant="ghost" onClick={() => setViewStudent(s)}><Icon name="eye" size={13} /></Btn>
                        {(canManageAllStudents || isClassTeacher || myOwnClasses.includes(s.class)) && <Btn size="sm" variant="ghost" onClick={() => openEdit(s)}><Icon name="edit" size={13} /></Btn>}
                        {isPrincipal && <Btn size="sm" variant="danger" onClick={() => deleteStudent(s.id)}><Icon name="trash" size={13} /></Btn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&(
                <tr><td colSpan={8} style={{...TS.td,textAlign:'center',color:'var(--text-muted)',padding:28}}>No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Student Modal */}
      <Modal show={show} onClose={() => { setShow(false); setForm(initForm()); }} title="Add New Student">

        {/* Name fields */}
        <div style={{fontSize:12,fontWeight:600,color:'#1e40af',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Student Name</div>
        <FormRow>
          <FormGroup label="First Name *">
            <input value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} placeholder="e.g. Kamau" autoFocus />
          </FormGroup>
          <FormGroup label="Last Name *">
            <input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} placeholder="e.g. Njoroge" />
          </FormGroup>
        </FormRow>
        <FormGroup label="Other Name (optional)">
          <input value={form.otherName} onChange={e=>setForm({...form,otherName:e.target.value})} placeholder="e.g. Mwangi (middle or clan name)" />
        </FormGroup>
        <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:14,padding:'6px 10px',background:'#f0f9ff',borderRadius:6}}>
          Full name preview: <strong>{buildStudentName(form.firstName,form.lastName,form.otherName)||'—'}</strong>
        </div>

        {/* Admission number — only show if not auto */}
        {admMode === 'manual' && (
          <FormGroup label="Admission Number *">
            <input value={form.admNo} onChange={e=>setForm({...form,admNo:e.target.value})} placeholder="e.g. KPS/001/2024" />
          </FormGroup>
        )}
        {admMode === 'mixed' && (
          <FormGroup label="Admission Number (optional — leave blank to auto-assign internally)">
            <input value={form.admNo} onChange={e=>setForm({...form,admNo:e.target.value})} placeholder="Enter if available, or leave blank" />
          </FormGroup>
        )}
        {admMode === 'auto' && (
          <Alert type="info"><Icon name="alert" size={13}/> Admission number will be auto-assigned: <strong>{generateAdmNo(data, data.students)}</strong></Alert>
        )}

        <FormRow>
          <FormGroup label="Class">
            <select value={form.class} onChange={e=>setForm({...form,class:e.target.value})} disabled={isClassTeacher&&!canManageAllStudents}>
              {addableClasses.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Date of Birth">
            <input type="date" value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} />
          </FormGroup>
        </FormRow>

        <div style={{fontSize:12,fontWeight:600,color:'#1e40af',marginBottom:8,marginTop:8,textTransform:'uppercase',letterSpacing:1}}>Parent / Guardian</div>
        <FormRow>
          <FormGroup label="Parent/Guardian Name">
            <input value={form.parentName} onChange={e=>setForm({...form,parentName:e.target.value})} />
          </FormGroup>
          <FormGroup label="Parent Phone">
            <input value={form.parentPhone} onChange={e=>setForm({...form,parentPhone:e.target.value})} placeholder="e.g. 0712345678"/>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Parent Email (optional)">
            <input type="email" value={form.parentEmail} onChange={e=>setForm({...form,parentEmail:e.target.value})} />
          </FormGroup>
          <FormGroup label="Year Joined">
            <input value={form.joined} onChange={e=>setForm({...form,joined:e.target.value})} />
          </FormGroup>
        </FormRow>

        <Alert type="info"><Icon name="alert" size={13}/> A <strong>Student Login Code (SLC)</strong> will be auto-generated and printed on their report form. Fee details are managed in the Fees module.</Alert>

        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>{setShow(false);setForm(initForm());}}>Cancel</Btn>
          <Btn onClick={save} disabled={!form.firstName.trim()&&!form.lastName.trim()}>Add Student</Btn>
        </div>
      </Modal>

      {/* ── Bulk Upload Modal ───────────────────────── */}
      <Modal show={showUpload} onClose={() => setShowUpload(false)} title="Bulk Upload Students" wide>

        {!uploadDone ? (
          <>
            {/* Step 1 — Download template */}
            <div style={{ background:'var(--surface2)', borderRadius:10, padding:'14px 16px', marginBottom:16, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:6 }}>
                Step 1 — Download the Excel template
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>
                Fill in student details in the template. Column names must stay the same.
                Admission Number column {data.admissionSetting === 'auto' ? 'is NOT included (auto-assigned)' : data.admissionSetting === 'mixed' ? 'is optional' : 'is required'}.
              </div>
              <Btn variant="ghost" size="sm" onClick={downloadTemplate}>
                <Icon name="download" size={13} /> Download Template (.xlsx)
              </Btn>
            </div>

            {/* Step 2 — Upload filled file */}
            <div style={{ background:'var(--surface2)', borderRadius:10, padding:'14px 16px', marginBottom:16, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:6 }}>
                Step 2 — Upload your filled Excel or CSV file
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>
                Supported formats: .xlsx, .xls, .csv
              </div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 16px', background:'#4f8ef7', color:'#fff', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                <Icon name="upload" size={13} /> Choose File
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUploadFile} style={{ display:'none' }} />
              </label>
            </div>

            {/* Preview parsed rows */}
            {uploadRows.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:8 }}>
                  Step 3 — Review & Import ({uploadRows.length} rows found)
                </div>
                <div style={{ maxHeight:240, overflowY:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead>
                      <tr style={{ background:'#1a2540', position:'sticky', top:0 }}>
                        {['Row','First Name','Last Name','Other Name',...(data.admissionSetting!=='auto'?['Adm No']:[]),'Class','DOB','Parent Name','Parent Phone','Year'].map(h=>(
                          <th key={h} style={{ padding:'7px 10px', textAlign:'left', color:'var(--text-muted)', fontWeight:600, borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadRows.map((row,i) => (
                        <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                          <td style={{ padding:'5px 10px', color:'var(--text-muted)' }}>{row.rowNum}</td>
                          <td style={{ padding:'5px 10px', color: row.firstName?'var(--text)':'#ef4444', fontWeight:row.firstName?400:700 }}>{row.firstName||'⚠ Missing'}</td>
                          <td style={{ padding:'5px 10px', color: row.lastName?'var(--text)':'#ef4444' }}>{row.lastName||'⚠ Missing'}</td>
                          <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.otherName||'—'}</td>
                          {data.admissionSetting!=='auto' && <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.admNo||'—'}</td>}
                          <td style={{ padding:'5px 10px', color: row.class?'var(--text)':'#ef4444' }}>{row.class||'⚠ Missing'}</td>
                          <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.dob||'—'}</td>
                          <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.parentName||'—'}</td>
                          <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.parentPhone||'—'}</td>
                          <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.joined||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:12, justifyContent:'flex-end' }}>
                  <Btn variant="ghost" onClick={() => { setUploadRows([]); setUploadErrors([]); }}>Clear</Btn>
                  <Btn variant="success" onClick={importRows}>
                    <Icon name="check" size={14} /> Import {uploadRows.length} Students
                  </Btn>
                </div>
              </div>
            )}

            {uploadErrors.length > 0 && !uploadDone && (
              <Alert type="warning">
                <div style={{ fontSize:12 }}>
                  {uploadErrors.slice(0,5).map((e,i) => <div key={i}>⚠ {e}</div>)}
                  {uploadErrors.length > 5 && <div>...and {uploadErrors.length-5} more issues</div>}
                </div>
              </Alert>
            )}
          </>
        ) : (
          /* Done screen */
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <div style={{ fontSize:56, marginBottom:16 }}>
              {uploadSummary?.added > 0 ? '✅' : '⚠️'}
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:'var(--text)', marginBottom:8 }}>
              Upload Complete
            </div>
            <div style={{ fontSize:14, color:'var(--text-sub)', marginBottom:20 }}>
              <span style={{ color:'#10b981', fontWeight:700 }}>{uploadSummary?.added} students added</span>
              {uploadSummary?.skipped > 0 && <span style={{ color:'#f59e0b' }}> · {uploadSummary.skipped} rows skipped</span>}
            </div>
            {uploadErrors.length > 0 && (
              <div style={{ background:'var(--surface2)', borderRadius:8, padding:'12px 16px', marginBottom:16, textAlign:'left', maxHeight:160, overflowY:'auto' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>Skipped rows:</div>
                {uploadErrors.map((e,i) => <div key={i} style={{ fontSize:12, color:'var(--text-muted)', marginBottom:2 }}>• {e}</div>)}
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <Btn variant="ghost" onClick={() => { setUploadDone(false); setUploadRows([]); setUploadErrors([]); setUploadSummary(null); }}>
                Upload Another File
              </Btn>
              <Btn onClick={() => setShowUpload(false)}>Done</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Student Modal */}
      {showEdit && editForm && (
        <Modal show={showEdit} onClose={() => { setShowEdit(false); setEditForm(null); }} title="Edit Student">
          <div style={{fontSize:12,fontWeight:600,color:'#4f8ef7',marginBottom:8,textTransform:'uppercase'}}>Student Name</div>
          <FormRow>
            <FormGroup label="First Name *">
              <input value={editForm.firstName} onChange={e=>setEditForm({...editForm,firstName:e.target.value})} autoFocus />
            </FormGroup>
            <FormGroup label="Last Name *">
              <input value={editForm.lastName} onChange={e=>setEditForm({...editForm,lastName:e.target.value})} />
            </FormGroup>
          </FormRow>
          <FormGroup label="Other Name (optional)">
            <input value={editForm.otherName} onChange={e=>setEditForm({...editForm,otherName:e.target.value})} />
          </FormGroup>
          <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:14,padding:'6px 10px',background:'#f0f9ff',borderRadius:6}}>
            Full name preview: <strong>{buildStudentName(editForm.firstName,editForm.lastName,editForm.otherName)||'—'}</strong>
          </div>
          {admMode==='manual' && (
            <FormGroup label="Admission Number">
              <input value={editForm.admNo} onChange={e=>setEditForm({...editForm,admNo:e.target.value})} />
            </FormGroup>
          )}
          <FormRow>
            <FormGroup label="Class">
              <select value={editForm.class} onChange={e=>setEditForm({...editForm,class:e.target.value})}
                disabled={isClassTeacher&&!canManageAllStudents&&!canManageOwnClasses}>
                {(canManageAllStudents ? getAllClasses(data) : (isClassTeacher ? [myClass] : myOwnClasses)).map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Date of Birth">
              <input type="date" value={editForm.dob} onChange={e=>setEditForm({...editForm,dob:e.target.value})} />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Parent/Guardian Name">
              <input value={editForm.parentName} onChange={e=>setEditForm({...editForm,parentName:e.target.value})} />
            </FormGroup>
            <FormGroup label="Parent Phone">
              <input value={editForm.parentPhone} onChange={e=>setEditForm({...editForm,parentPhone:e.target.value})} />
            </FormGroup>
          </FormRow>
          <FormGroup label="Year Joined">
            <input value={editForm.joined} onChange={e=>setEditForm({...editForm,joined:e.target.value})} />
          </FormGroup>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <Btn variant="ghost" onClick={()=>{setShowEdit(false);setEditForm(null);}}>Cancel</Btn>
            <Btn variant="success" onClick={saveEdit} disabled={!editForm.firstName.trim()&&!editForm.lastName.trim()}>
              Save Changes
            </Btn>
          </div>
        </Modal>
      )}

    </div>
  );
}

const TS = {
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:    { textAlign:'left', padding:'10px 14px', fontSize:11, fontWeight:700, color:'var(--text-sub)', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid var(--border)', background:'var(--surface2)' },
  td:    { padding:'10px 14px', borderBottom:'1px solid var(--border)', color:'var(--text)' },
};
