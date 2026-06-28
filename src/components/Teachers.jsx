import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, Avatar, Alert, Icon } from './UI';
import * as XLSX from 'xlsx';
import { getAllClasses, getSubjectsForClass, CURRICULUM_LEVELS } from '../data/initialData';
import { printStaffIntakeForm, printTeacherLoginSheet } from '../utils/print';
import { PendingTeacherApprovals, InviteLinkGenerator } from './TeacherRegistration';

const STAFF_TYPES = [
  { value: 'teaching',     label: 'Teaching Staff' },
  { value: 'non_teaching', label: 'Non-Teaching Staff' },
];

const DEPT_ICONS = {
  Academics: '📚', Management: '🏫', Kitchen: '🍳', Sports: '⚽',
  Library: '📖', Finance: '💰', Counselling: '🧡', Security: '🔒',
};

/* Get all subjects relevant to a set of classes — Settings only, no hardcoded extras */
function getSubjectsForClasses(classes, data) {
  const set = new Set();
  classes.forEach(cls => getSubjectsForClass(cls, data).forEach(s => set.add(s)));
  return [...set].sort();
}

const BLANK_FORM = {
  name: '', email: '', phone: '', staffId: '',
  dept: 'Academics', staffType: 'teaching',
  isClassTeacher: false, classTeacherOf: '',
  canSeeKitchenAlerts: false, canSeeFees: false,
  canEnterAllMarks: false,
  admin: false, password: '',
};

export default function Teachers({ data, setData , isDark, themeVars }) {
  const _bg = themeVars ? themeVars['--bg'] : 'var(--bg)';
  const _surface = themeVars ? themeVars['--surface'] : 'var(--surface)';
  const _text = themeVars ? themeVars['--text'] : 'var(--text)';

  const [show, setShow]           = useState(false);
  const [isEditing, setIsEditing] = useState(false);   // true = edit mode
  const [editId, setEditId]       = useState(null);    // id of staff being edited
  const [search, setSearch]       = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [form, setForm]           = useState({ ...BLANK_FORM });
  const [subjectRows, setSubjectRows] = useState([{ subject: '', classes: [] }]);

  const allClasses = getAllClasses(data);
  const depts      = data.departments;

  // ── Bulk upload state ─────────────────────────────────────
  const [showStaffUpload,    setShowStaffUpload]    = useState(false);
  const [staffUploadRows,    setStaffUploadRows]    = useState([]);
  const [staffUploadErrors,  setStaffUploadErrors]  = useState([]);
  const [staffUploadDone,    setStaffUploadDone]    = useState(false);
  const [staffUploadSummary, setStaffUploadSummary] = useState(null);

  function downloadStaffTemplate() {
    const headers = ['Name','Staff ID','Email','Phone','Department','Staff Type (teaching/non_teaching)','Is Class Teacher (Yes/No)','Class Teacher Of','Password'];
    const example = ['Jane Njeri','T009','jane@school.ac.ke','0712345678','Academics','teaching','No','',''];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 20) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff');
    XLSX.writeFile(wb, 'staff_upload_template.xlsx');
  }

  function handleStaffUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStaffUploadErrors([]);
    setStaffUploadRows([]);
    setStaffUploadDone(false);
    setStaffUploadSummary(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type:'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (rows.length < 2) { setStaffUploadErrors(['File is empty or has no data rows.']); return; }
        const headers = (rows[0]||[]).map(h => String(h).trim().toLowerCase());
        const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim()));
        function col(row, ...names) {
          for (const name of names) {
            const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
            if (idx >= 0 && row[idx] !== undefined) return String(row[idx]).trim();
          }
          return '';
        }
        const parsed = dataRows.map((row, i) => ({
          rowNum:        i + 2,
          name:          col(row, 'name'),
          staffId:       col(row, 'staff id', 'staffid', 'id'),
          email:         col(row, 'email'),
          phone:         col(row, 'phone', 'mobile'),
          dept:          col(row, 'department', 'dept'),
          staffType:     col(row, 'staff type', 'type').toLowerCase().includes('non') ? 'non_teaching' : 'teaching',
          isClassTeacher:col(row, 'class teacher', 'isclassteacher').toLowerCase() === 'yes',
          classTeacherOf:col(row, 'class teacher of', 'classteacherof'),
          password:      col(row, 'password'),
        }));
        setStaffUploadRows(parsed);
      } catch(err) {
        setStaffUploadErrors(['Could not read file: ' + err.message]);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  function importStaffRows() {
    const errors = [];
    const toAdd  = [];
    staffUploadRows.forEach(row => {
      if (!row.name) { errors.push(`Row ${row.rowNum}: Missing name — skipped.`); return; }
      if (!row.staffId) { errors.push(`Row ${row.rowNum}: Missing Staff ID — skipped.`); return; }
      if (data.teachers.find(t => t.staffId === row.staffId)) {
        errors.push(`Row ${row.rowNum}: Staff ID "${row.staffId}" already exists — skipped.`); return;
      }
      const dept = depts.find(d => d.toLowerCase() === row.dept.toLowerCase()) || row.dept || 'Academics';
      toAdd.push({
        id:             Date.now() + Math.random(),
        name:           row.name,
        staffId:        row.staffId,
        email:          row.email,
        phone:          row.phone,
        dept,
        staffType:      row.staffType || 'teaching',
        isClassTeacher: row.isClassTeacher || false,
        classTeacherOf: row.classTeacherOf || null,
        subjects:       [],
        canSeeKitchenAlerts: dept.toLowerCase() === 'kitchen',
        canSeeFees:     dept.toLowerCase() === 'finance',
        admin:          false,
        password:       row.password || row.staffId,
        status:         'active',
      });
    });
    if (toAdd.length > 0) {
      setData(d => ({ ...d, teachers: [...d.teachers, ...toAdd] }));
    }
    setStaffUploadErrors(errors);
    setStaffUploadSummary({ added: toAdd.length, skipped: errors.length });
    setStaffUploadDone(true);
    setStaffUploadRows([]);
  }

  /* ── Subject row helpers ──────────────────────────── */
  function addSubjectRow() {
    setSubjectRows(r => [...r, { subject: '', classes: [] }]);
  }
  function removeSubjectRow(i) {
    setSubjectRows(r => r.filter((_, idx) => idx !== i));
  }
  function updateSubjectRow(i, field, value) {
    setSubjectRows(r => r.map((row, idx) => {
      if (idx !== i) return row;
      const updated = { ...row, [field]: value };
      if (field === 'classes') {
        const avail = getSubjectsForClasses(value, data);
        if (updated.subject && !avail.includes(updated.subject)) updated.subject = '';
      }
      return updated;
    }));
  }
  function toggleSubjectClass(rowIdx, cls) {
    setSubjectRows(r => r.map((row, idx) => {
      if (idx !== rowIdx) return row;
      const classes = row.classes.includes(cls)
        ? row.classes.filter(c => c !== cls)
        : [...row.classes, cls];
      const avail   = getSubjectsForClasses(classes, data);
      const subject = avail.includes(row.subject) ? row.subject : '';
      return { ...row, classes, subject };
    }));
  }

  /* ── Open add ─────────────────────────────────────── */
  function openAdd() {
    setForm({ ...BLANK_FORM });
    setSubjectRows([{ subject: '', classes: [] }]);
    setIsEditing(false);
    setEditId(null);
    setShow(true);
  }

  /* ── Open edit ────────────────────────────────────── */
  function openEdit(t) {
    setForm({
      name:               t.name       || '',
      email:              t.email      || '',
      phone:              t.phone      || '',
      staffId:            t.staffId    || '',
      dept:               t.dept       || 'Academics',
      staffType:          t.staffType  || 'teaching',
      isClassTeacher:     t.isClassTeacher || false,
      classTeacherOf:     t.classTeacherOf || '',
      canSeeKitchenAlerts: t.canSeeKitchenAlerts || false,
      canSeeFees:         t.canSeeFees || false,
      canEnterAllMarks:   t.canEnterAllMarks || false,
      admin:              t.admin      || false,
      password:           t.password   || t.staffId || '',
    });
    // Restore subject rows
    const rows = (t.subjects && t.subjects.length > 0)
      ? t.subjects.map(s => ({ subject: s.subject || '', classes: s.classes || [] }))
      : [{ subject: '', classes: [] }];
    setSubjectRows(rows);
    setIsEditing(true);
    setEditId(t.id);
    setShow(true);
  }

  /* ── Save (add or edit) ───────────────────────────── */
  function save() {
    if (!form.name.trim() || !form.staffId.trim()) {
      alert('Please fill in Name and Staff ID.');
      return;
    }

    // Duplicate staffId check — skip self when editing
    const dupId = data.teachers.find(t => t.staffId === form.staffId.trim() && t.id !== editId);
    if (dupId) {
      alert(`Staff ID "${form.staffId}" already exists. Please use a unique ID.`);
      return;
    }
    // Duplicate email check — skip self when editing
    if (form.email) {
      const dupEmail = data.teachers.find(t => t.email === form.email.trim() && t.id !== editId);
      if (dupEmail) {
        alert(`Email "${form.email}" is already registered.`);
        return;
      }
    }

    const validSubjects = subjectRows.filter(r => r.subject && r.classes.length > 0);

    const record = {
      name:               form.name.trim(),
      email:              form.email.trim(),
      phone:              form.phone.trim(),
      staffId:            form.staffId.trim(),
      dept:               form.dept,
      staffType:          form.staffType,
      isClassTeacher:     form.isClassTeacher && form.staffType === 'teaching',
      classTeacherOf:     form.isClassTeacher && form.classTeacherOf ? form.classTeacherOf : null,
      subjects:           validSubjects,
      canSeeKitchenAlerts: form.canSeeKitchenAlerts || form.dept === 'Kitchen',
      canSeeFees:         form.canSeeFees || form.dept === 'Finance',
      canEnterAllMarks:   form.canEnterAllMarks || false,
      admin:              form.admin,
      password:           form.password || form.staffId.trim(),
    };

    if (isEditing) {
      setData(d => ({
        ...d,
        teachers: d.teachers.map(t => t.id === editId ? { ...t, ...record } : t),
      }));
    } else {
      setData(d => ({
        ...d,
        teachers: [...d.teachers, { id: Date.now(), ...record }],
      }));
    }

    setShow(false);
    setForm({ ...BLANK_FORM });
    setSubjectRows([{ subject: '', classes: [] }]);
    setIsEditing(false);
    setEditId(null);
  }

  /* ── Delete ───────────────────────────────────────── */
  function remove(id) {
    if (window.confirm('Remove this staff member? This cannot be undone.')) {
      setData(d => ({ ...d, teachers: d.teachers.filter(t => t.id !== id) }));
    }
  }

  /* ── Filter ───────────────────────────────────────── */
  const filtered = data.teachers.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                        (t.staffId || '').toLowerCase().includes(search.toLowerCase());
    const matchDept   = !filterDept || t.dept === filterDept;
    return matchSearch && matchDept;
  });

  const teaching    = filtered.filter(t => t.staffType === 'teaching' && !t.admin);
  const nonTeaching = filtered.filter(t => t.staffType === 'non_teaching' && !t.admin);
  const admins      = filtered.filter(t => t.admin);

  /* ── Staff card ───────────────────────────────────── */
  function StaffGroup({ title, list, color }) {
    if (!list.length) return null;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          {title} ({list.length})
        </div>
        {list.map(t => (
          <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Avatar name={t.name} size={46} color={color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</span>
                {t.admin && <Tag color="purple">Admin</Tag>}
                {t.isClassTeacher && <Tag color="green">Class Teacher: {t.classTeacherOf}</Tag>}
                <Tag color="blue">{t.dept}</Tag>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 4 }}>
                  {t.staffId}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                {t.email && <span>{t.email}</span>}
                {t.phone && <span style={{ marginLeft: 12 }}>📱 {t.phone}</span>}
                <span style={{ marginLeft: 12, color: '#4f8ef7' }}>Password: {t.password || t.staffId}</span>
              </div>
              {t.subjects && t.subjects.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {t.subjects.map((s, i) => (
                    <span key={i} style={{ background: '#4f8ef710', border: '1px solid #4f8ef730', borderRadius: 6, padding: '2px 10px', fontSize: 11, color: '#4f8ef7' }}>
                      {s.subject}: {s.classes.join(', ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Btn size="sm" variant="ghost" onClick={() => openEdit(t)} title="Edit staff member">
                <Icon name="edit" size={13} />
              </Btn>
              <Btn size="sm" variant="danger" onClick={() => remove(t.id)} title="Remove staff member">
                <Icon name="trash" size={13} />
              </Btn>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function SubjectRows() {
    const levelGroups = Object.entries(CURRICULUM_LEVELS).map(([key, level]) => ({
      key, label: level.label,
      classes: allClasses.filter(c => {
        const name = c.toLowerCase();
        return level.classes.some(lc => name.startsWith(lc.toLowerCase()));
      }),
      isLowerPrimary: key === 'LOWER_PRIMARY',
    })).filter(g => g.classes.length > 0);

    // "Assign All Subjects" for a Lower Primary class — one click assigns
    // every subject in that class to the teacher across all subject rows
    function assignAllSubjectsForClass(cls) {
      const allSubs = getSubjectsForClass(cls, data);
      if (!allSubs.length) return;
      setSubjectRows(rows => {
        // Remove any existing rows for this class first to avoid duplicates
        const cleaned = rows.filter(r => !r.classes.includes(cls) || r.classes.length > 1);
        // Add one row per subject for this class
        const newRows = allSubs.map(sub => ({ subject: sub, classes: [cls] }));
        // Keep rows for other classes + add all subjects for this class
        return [...cleaned.filter(r => !r.classes.includes(cls)), ...newRows];
      });
    }

    return (
      <>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 10 }}>
          Add each subject this teacher teaches and select the classes.
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> Subject list filters to match selected classes.</span>
        </div>

        {/* Lower Primary quick-assign panel */}
        {levelGroups.filter(g => g.isLowerPrimary).map(group => (
          <div key={group.key} style={{ background: '#10b98112', border: '1px solid #10b98140', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>
              ⚡ Lower Primary — Quick Assign All Subjects
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              For Grade 1, 2 or 3 teachers who teach ALL subjects in their class — click one button:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {group.classes.map(cls => (
                <Btn key={cls} size="sm" variant="ghost"
                  style={{ borderColor: '#10b981', color: '#10b981' }}
                  onClick={() => assignAllSubjectsForClass(cls)}>
                  ✓ Assign All Subjects → {cls}
                </Btn>
              ))}
            </div>
          </div>
        ))}

        {subjectRows.map((row, i) => {
          const availSubs = row.classes.length > 0
            ? getSubjectsForClasses(row.classes, data)
            : getSubjectsForClasses(allClasses, data);

          return (
            <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Subject</div>
                  <select
                    value={row.subject}
                    onChange={e => updateSubjectRow(i, 'subject', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">— Select subject —</option>
                    {availSubs.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {subjectRows.length > 1 && (
                  <button onClick={() => removeSubjectRow(i)}
                    style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, alignSelf: 'flex-end' }}>
                    Remove
                  </button>
                )}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                Classes teaching <strong style={{ color: 'var(--text-sub)' }}>{row.subject || 'this subject'}</strong>:
              </div>

              {levelGroups.map(group => (
                <div key={group.key} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                    {group.label}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {group.classes.map(c => {
                      const active = row.classes.includes(c);
                      return (
                        <div key={c} onClick={() => toggleSubjectClass(i, c)} style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500, userSelect: 'none',
                          background: active ? '#4f8ef7' : 'var(--surface2)',
                          color:      active ? '#fff'    : 'var(--text-sub)',
                          border:    `1px solid ${active ? '#4f8ef7' : 'var(--border)'}`,
                        }}>
                          {c}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {row.subject && row.classes.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#10b981' }}>
                  ✓ {row.subject} → {row.classes.join(', ')}
                </div>
              )}
            </div>
          );
        })}

        <button onClick={addSubjectRow}
          style={{ background: 'none', border: '1px dashed var(--border)', color: 'var(--text-muted)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 12, width: '100%', marginBottom: 8 }}>
          + Add Another Subject
        </button>
      </>
    );
  }

  /* ── Render ───────────────────────────────────────── */
  return (
    <div>
      <InviteLinkGenerator data={data} />
      <PendingTeacherApprovals data={data} setData={setData} />

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search by name or staff ID..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 160 }}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => printStaffIntakeForm(data)}>
            <Icon name="print" size={14} /> Staff Form
          </Btn>
          <Btn variant="ghost" onClick={() => printTeacherLoginSheet(data)}>
            📧 Print Login Emails
          </Btn>
          <Btn variant="ghost" onClick={() => { setShowStaffUpload(true); setStaffUploadRows([]); setStaffUploadErrors([]); setStaffUploadDone(false); setStaffUploadSummary(null); }}>
            <Icon name="upload" size={14} /> Bulk Upload
          </Btn>
          <Btn onClick={openAdd}><Icon name="add" size={14} /> Add Staff Member</Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Total Staff',    v: data.teachers.length,                                        c: '#4f8ef7' },
          { l: 'Teaching Staff', v: data.teachers.filter(t => t.staffType === 'teaching').length, c: '#10b981' },
          { l: 'Non-Teaching',   v: data.teachers.filter(t => t.staffType === 'non_teaching').length, c: '#f59e0b' },
          { l: 'Class Teachers', v: data.teachers.filter(t => t.isClassTeacher).length,          c: '#7c3aed' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          No staff found. Click "Add Staff Member" to get started.
        </div>
      )}

      <StaffGroup title="Administrators"     list={admins}      color="#7c3aed" />
      <StaffGroup title="Teaching Staff"     list={teaching}    color="#4f8ef7" />
      <StaffGroup title="Non-Teaching Staff" list={nonTeaching} color="#10b981" />

      {/* ── Add / Edit Staff Modal ─────────────────────── */}
      <Modal show={show} onClose={() => setShow(false)} title={isEditing ? 'Edit Staff Member' : 'Add Staff Member'} wide>

        {!isEditing && (
          <Alert type="info">
            <Icon name="alert" size={14} />
            Default login password is the Staff ID. They can change it later.
          </Alert>
        )}

        {isEditing && (
          <Alert type="warning">
            <Icon name="alert" size={14} />
            Editing staff details. Leave Password blank to keep the existing one.
          </Alert>
        )}

        {/* Basic info */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4f8ef7', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Basic Information
        </div>
        <FormRow>
          <FormGroup label="Full Name *">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jane Njeri" autoFocus />
          </FormGroup>
          <FormGroup label="Staff ID *">
            <input value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })} placeholder="e.g. T008"
              disabled={isEditing} // Don't allow changing staffId on edit — it's a login key
              style={isEditing ? { opacity: 0.5 } : {}}
            />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Email Address">
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jane@school.ac.ke" />
          </FormGroup>
          <FormGroup label="Phone Number">
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0712345678" />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Department">
            <select value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })}>
              {depts.map(d => <option key={d} value={d}>{DEPT_ICONS[d] || '🏢'} {d}</option>)}
            </select>
          </FormGroup>
        </FormRow>
        <FormGroup label="Staff Type">
          <select value={form.staffType} onChange={e => setForm({ ...form, staffType: e.target.value })}>
            {STAFF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </FormGroup>

        {isEditing && (
          <FormGroup label="Password (leave blank to keep current)">
            <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Enter new password or leave blank" />
          </FormGroup>
        )}

        {/* Teaching-only fields */}
        {form.staffType === 'teaching' && (
          <>
            <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4f8ef7', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Teaching Assignment
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, marginBottom: 10 }}>
                <input type="checkbox" checked={form.isClassTeacher}
                  onChange={e => setForm({ ...form, isClassTeacher: e.target.checked, classTeacherOf: '' })} />
                This teacher is a Class Teacher (responsible for one class)
              </label>
              {form.isClassTeacher && (
                <FormGroup label="Class Teacher of">
                  <select value={form.classTeacherOf} onChange={e => setForm({ ...form, classTeacherOf: e.target.value })}>
                    <option value="">Select class...</option>
                    {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormGroup>
              )}
            </div>

            <SubjectRows />
          </>
        )}

        {/* Permissions */}
        <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0' }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4f8ef7', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
          Permissions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { field: 'admin',               label: 'Grant Admin / Principal Privileges (full access)' },
            { field: 'canSeeFees',          label: 'Can view fee & financial records' },
            { field: 'canSeeKitchenAlerts', label: 'Receives kitchen inventory alerts' },
            { field: 'canEnterAllMarks',    label: 'Can enter marks for ALL subjects in ALL classes (e.g. Secretary)' },
          ].map(({ field, label }) => (
            <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={form[field]} onChange={e => setForm({ ...form, [field]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn>
          <Btn onClick={save} disabled={!form.name.trim() || !form.staffId.trim()}>
            <Icon name={isEditing ? 'check' : 'add'} size={14} />
            {isEditing ? 'Save Changes' : 'Add Staff Member'}
          </Btn>
        </div>
      </Modal>

      {/* ── Staff Bulk Upload Modal ─────────────────── */}
      <Modal show={showStaffUpload} onClose={() => setShowStaffUpload(false)} title="Bulk Upload Staff Members" wide>
        {!staffUploadDone ? (
          <>
            <div style={{ background:'var(--surface2)', borderRadius:10, padding:'14px 16px', marginBottom:16, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:6 }}>Step 1 — Download the Excel template</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>
                Fill in staff details. Columns: Name, Staff ID, Email, Phone, Department, Staff Type, Is Class Teacher, Class Teacher Of, Password.
                Subjects are assigned manually after upload.
              </div>
              <Btn variant="ghost" size="sm" onClick={downloadStaffTemplate}>
                <Icon name="download" size={13} /> Download Template (.xlsx)
              </Btn>
            </div>

            <div style={{ background:'var(--surface2)', borderRadius:10, padding:'14px 16px', marginBottom:16, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:6 }}>Step 2 — Upload your filled file</div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 16px', background:'#4f8ef7', color:'#fff', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                <Icon name="upload" size={13} /> Choose File (.xlsx / .csv)
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleStaffUploadFile} style={{ display:'none' }} />
              </label>
            </div>

            {staffUploadRows.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:8 }}>
                  Step 3 — Review & Import ({staffUploadRows.length} rows found)
                </div>
                <div style={{ maxHeight:220, overflowY:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead>
                      <tr style={{ background:'#1a2540', position:'sticky', top:0 }}>
                        {['Row','Name','Staff ID','Email','Phone','Dept','Type','Class Teacher'].map(h => (
                          <th key={h} style={{ padding:'7px 10px', textAlign:'left', color:'var(--text-muted)', fontWeight:600, borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {staffUploadRows.map((row,i) => (
                        <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                          <td style={{ padding:'5px 10px', color:'var(--text-muted)' }}>{row.rowNum}</td>
                          <td style={{ padding:'5px 10px', color:row.name?'var(--text)':'#ef4444', fontWeight:row.name?400:700 }}>{row.name||'⚠ Missing'}</td>
                          <td style={{ padding:'5px 10px', color:row.staffId?'#4f8ef7':'#ef4444', fontFamily:'monospace' }}>{row.staffId||'⚠ Missing'}</td>
                          <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.email||'—'}</td>
                          <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.phone||'—'}</td>
                          <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.dept||'—'}</td>
                          <td style={{ padding:'5px 10px', color:'var(--text-sub)' }}>{row.staffType}</td>
                          <td style={{ padding:'5px 10px', color:row.isClassTeacher?'#10b981':'var(--text-muted)' }}>{row.isClassTeacher?`Yes — ${row.classTeacherOf}`:'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:12, justifyContent:'flex-end' }}>
                  <Btn variant="ghost" onClick={() => { setStaffUploadRows([]); setStaffUploadErrors([]); }}>Clear</Btn>
                  <Btn variant="success" onClick={importStaffRows}>
                    <Icon name="check" size={14} /> Import {staffUploadRows.length} Staff
                  </Btn>
                </div>
              </div>
            )}

            {staffUploadErrors.length > 0 && !staffUploadDone && (
              <Alert type="warning">
                <div style={{ fontSize:12 }}>
                  {staffUploadErrors.slice(0,5).map((e,i) => <div key={i}>⚠ {e}</div>)}
                  {staffUploadErrors.length > 5 && <div>...and {staffUploadErrors.length-5} more issues</div>}
                </div>
              </Alert>
            )}
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <div style={{ fontSize:56, marginBottom:16 }}>{staffUploadSummary?.added > 0 ? '✅' : '⚠️'}</div>
            <div style={{ fontSize:20, fontWeight:800, color:'var(--text)', marginBottom:8 }}>Upload Complete</div>
            <div style={{ fontSize:14, color:'var(--text-sub)', marginBottom:20 }}>
              <span style={{ color:'#10b981', fontWeight:700 }}>{staffUploadSummary?.added} staff members added</span>
              {staffUploadSummary?.skipped > 0 && <span style={{ color:'#f59e0b' }}> · {staffUploadSummary.skipped} rows skipped</span>}
            </div>
            {staffUploadErrors.length > 0 && (
              <div style={{ background:'var(--surface2)', borderRadius:8, padding:'12px 16px', marginBottom:16, textAlign:'left', maxHeight:140, overflowY:'auto' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>Skipped rows:</div>
                {staffUploadErrors.map((e,i) => <div key={i} style={{ fontSize:12, color:'var(--text-muted)', marginBottom:2 }}>• {e}</div>)}
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <Btn variant="ghost" onClick={() => { setStaffUploadDone(false); setStaffUploadRows([]); setStaffUploadErrors([]); setStaffUploadSummary(null); }}>Upload Another File</Btn>
              <Btn onClick={() => setShowStaffUpload(false)}>Done</Btn>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
