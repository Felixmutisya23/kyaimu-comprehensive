import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, Avatar, Alert, Icon } from './UI';
import { getAllClasses } from '../data/initialData';

const STAFF_TYPES = [
  { value: 'teaching',     label: 'Teaching Staff' },
  { value: 'non_teaching', label: 'Non-Teaching Staff' },
];

const DEPT_ICONS = {
  Academics: '📚', Management: '🏫', Kitchen: '🍳', Sports: '⚽',
  Library: '📖', Finance: '💰', Counselling: '🧡', Security: '🔒',
};

export default function Teachers({ data, setData }) {
  const [show, setShow]     = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [form, setForm]     = useState(initForm());

  // Subject-class rows: each row = { subject, classes[] }
  const [subjectRows, setSubjectRows] = useState([{ subject: '', classes: [] }]);

  function initForm() {
    return {
      name: '', email: '', phone: '', staffId: '',
      dept: 'Academics', staffType: 'teaching',
      isClassTeacher: false, classTeacherOf: '',
      canSeeKitchenAlerts: false, canSeeFees: false,
      admin: false, password: '',
    };
  }

  function addSubjectRow() {
    setSubjectRows(r => [...r, { subject: '', classes: [] }]);
  }

  function removeSubjectRow(i) {
    setSubjectRows(r => r.filter((_, idx) => idx !== i));
  }

  function updateSubjectRow(i, field, value) {
    setSubjectRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  function toggleSubjectClass(rowIdx, cls) {
    setSubjectRows(r => r.map((row, idx) => {
      if (idx !== rowIdx) return row;
      const classes = row.classes.includes(cls)
        ? row.classes.filter(c => c !== cls)
        : [...row.classes, cls];
      return { ...row, classes };
    }));
  }

  function save() {
    if (!form.name.trim() || !form.staffId.trim()) {
      alert('Please fill in Name and Staff ID.');
      return;
    }
    // Check duplicate staffId
    if (data.teachers.find(t => t.staffId === form.staffId.trim())) {
      alert(`Staff ID "${form.staffId}" already exists. Please use a unique ID.`);
      return;
    }
    // Check duplicate email
    if (form.email && data.teachers.find(t => t.email === form.email.trim())) {
      alert(`Email "${form.email}" is already registered.`);
      return;
    }

    const validSubjects = subjectRows.filter(r => r.subject && r.classes.length > 0);

    const newStaff = {
      id:                  Date.now(),
      name:                form.name.trim(),
      email:               form.email.trim(),
      phone:               form.phone.trim(),
      staffId:             form.staffId.trim(),
      dept:                form.dept,
      staffType:           form.staffType,
      isClassTeacher:      form.isClassTeacher && form.staffType === 'teaching',
      classTeacherOf:      form.isClassTeacher && form.classTeacherOf ? form.classTeacherOf : null,
      subjects:            validSubjects,
      canSeeKitchenAlerts: form.canSeeKitchenAlerts || form.dept === 'Kitchen',
      canSeeFees:          form.canSeeFees || form.dept === 'Finance',
      admin:               form.admin,
      password:            form.password || form.staffId.trim(), // default pw = staffId
    };

    setData(d => ({ ...d, teachers: [...d.teachers, newStaff] }));
    setShow(false);
    setForm(initForm());
    setSubjectRows([{ subject: '', classes: [] }]);
  }

  function remove(id) {
    if (window.confirm('Remove this staff member? This cannot be undone.')) {
      setData(d => ({ ...d, teachers: d.teachers.filter(t => t.id !== id) }));
    }
  }

  function openAdd() {
    setForm(initForm());
    setSubjectRows([{ subject: '', classes: [] }]);
    setShow(true);
  }

  const allClasses   = getAllClasses(data);
  const allSubjects  = [...data.subjects, 'Administration', 'Guidance & Counselling', 'Sports', 'Library'];
  const depts        = data.departments;

  const filtered = data.teachers.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                        (t.staffId || '').toLowerCase().includes(search.toLowerCase());
    const matchDept   = !filterDept || t.dept === filterDept;
    return matchSearch && matchDept;
  });

  const teaching    = filtered.filter(t => t.staffType === 'teaching' && !t.admin);
  const nonTeaching = filtered.filter(t => t.staffType === 'non_teaching' && !t.admin);
  const admins      = filtered.filter(t => t.admin);

  function StaffGroup({ title, list, color }) {
    if (!list.length) return null;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{title} ({list.length})</div>
        {list.map(t => (
          <div key={t.id} style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 12, padding: 16, marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Avatar name={t.name} size={46} color={color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</span>
                {t.admin && <Tag color="purple">Admin</Tag>}
                {t.isClassTeacher && <Tag color="green">Class Teacher: {t.classTeacherOf}</Tag>}
                <Tag color="blue">{t.dept}</Tag>
                <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', background: '#1e2435', padding: '2px 7px', borderRadius: 4 }}>{t.staffId}</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
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
            <Btn size="sm" variant="danger" onClick={() => remove(t.id)}>
              <Icon name="trash" size={13} />
            </Btn>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search by name or staff ID..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 160 }}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <Btn onClick={openAdd}><Icon name="add" size={14} /> Add Staff Member</Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Total Staff',       v: data.teachers.length,                                  c: '#4f8ef7' },
          { l: 'Teaching Staff',    v: data.teachers.filter(t => t.staffType==='teaching').length, c: '#10b981' },
          { l: 'Non-Teaching',      v: data.teachers.filter(t => t.staffType==='non_teaching').length, c: '#f59e0b' },
          { l: 'Class Teachers',    v: data.teachers.filter(t => t.isClassTeacher).length,    c: '#7c3aed' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{l}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b', background: '#171b26', borderRadius: 12, border: '1px solid #2a3350' }}>
          No staff found. Click "Add Staff Member" to get started.
        </div>
      )}

      <StaffGroup title="Administrators" list={admins} color="#7c3aed" />
      <StaffGroup title="Teaching Staff" list={teaching} color="#4f8ef7" />
      <StaffGroup title="Non-Teaching Staff" list={nonTeaching} color="#10b981" />

      {/* Add Staff Modal */}
      <Modal show={show} onClose={() => setShow(false)} title="Add Staff Member" wide>
        <Alert type="info">
          <Icon name="alert" size={14} />
          Default login password for this staff member will be their Staff ID. They can change it later.
        </Alert>

        {/* Basic info */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4f8ef7', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Basic Information</div>
        <FormRow>
          <FormGroup label="Full Name *">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jane Njeri" autoFocus />
          </FormGroup>
          <FormGroup label="Staff ID * (used as login password)">
            <input value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })} placeholder="e.g. T008" />
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
          <FormGroup label="Staff Type">
            <select value={form.staffType} onChange={e => setForm({ ...form, staffType: e.target.value })}>
              {STAFF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormGroup>
        </FormRow>

        {/* Teaching-only fields */}
        {form.staffType === 'teaching' && (
          <>
            <div style={{ borderTop: '1px solid #2a3350', margin: '14px 0 14px' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4f8ef7', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Teaching Assignment</div>

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

            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
              Subject assignments — add one row per subject. Select which classes they teach it in.
            </div>
            {subjectRows.map((row, i) => (
              <div key={i} style={{ background: '#1e2435', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <select value={row.subject} onChange={e => updateSubjectRow(i, 'subject', e.target.value)}
                    style={{ flex: 1 }}>
                    <option value="">Select subject...</option>
                    {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {subjectRows.length > 1 && (
                    <button onClick={() => removeSubjectRow(i)}
                      style={{ background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}>
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Classes this teacher teaches {row.subject || 'this subject'} in:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {allClasses.map(c => (
                    <div key={c} onClick={() => toggleSubjectClass(i, c)} style={{
                      padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                      background: row.classes.includes(c) ? '#4f8ef7' : '#252d42',
                      color: row.classes.includes(c) ? '#fff' : '#94a3b8',
                      border: `1px solid ${row.classes.includes(c) ? '#4f8ef7' : '#2a3350'}`,
                    }}>{c}</div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={addSubjectRow}
              style={{ background: 'none', border: '1px dashed #2a3350', color: '#64748b', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, marginBottom: 10, width: '100%' }}>
              + Add Another Subject
            </button>
          </>
        )}

        {/* Permissions */}
        <div style={{ borderTop: '1px solid #2a3350', margin: '14px 0 14px' }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4f8ef7', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Permissions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { field: 'admin',               label: 'Grant Admin / Principal Privileges (full access)' },
            { field: 'canSeeFees',          label: 'Can view fee & financial records' },
            { field: 'canSeeKitchenAlerts', label: 'Receives kitchen inventory alerts' },
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
            <Icon name="add" size={14} /> Add Staff Member
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
