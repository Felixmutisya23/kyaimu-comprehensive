import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, Alert, ProgressBar, Avatar, GradeBadge, Icon } from './UI';
import { getGrade, getAllClasses, getScore, getStreamFromClass } from '../data/initialData';
import { printLeavingCert, printReportForm } from '../utils/print';

export default function Students({ data, setData, user, isUnlocked = true }) {
  const isPrincipal    = user.role === 'principal';
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;

  // Class teachers can only see/add their own class
  // Subject teachers can see students in classes they teach (read-only)
  // Principal sees all
  function getVisibleStudents(search, filterClass) {
    let students = data.students;
    if (!isPrincipal) {
      if (isClassTeacher) {
        students = students.filter(s => s.class === myClass);
      } else {
        // Subject teacher — see students in their teaching classes
        const myClasses = (user.teacherSubjects || []).flatMap(s => s.classes);
        students = students.filter(s => myClasses.includes(s.class));
      }
    }
    if (filterClass) students = students.filter(s => s.class === filterClass);
    if (search) students = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.admNo.includes(search));
    return students;
  }

  const [show, setShow]           = useState(false);
  const [viewStudent, setViewStudent] = useState(null);
  const [search, setSearch]       = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [caseText, setCaseText]   = useState('');
  const [form, setForm]           = useState(initForm());

  // Compute total fee expected for a class in current term
  function computeFeesForClass(cls) {
    const curTerm = data.currentTerm || (new Date().getMonth() < 4 ? 1 : new Date().getMonth() < 8 ? 2 : 3);
    const curYear = data.currentYear || new Date().getFullYear();
    const types = data.feeTypes || [];
    const schedule = data.feeSchedule || [];
    return types.reduce((sum, ft) => {
      const applies = ft.appliesToAll || (ft.applicableClasses||[]).includes(cls);
      if (!applies) return sum;
      const sch = schedule.find(s =>
        s.feeTypeId === ft.id && (s.class === cls || s.class === 'ALL') &&
        s.term === Number(curTerm) && s.year === Number(curYear)
      );
      return sum + (sch ? Number(sch.amount) : 0);
    }, 0);
  }

  function initForm() {
    const cls = myClass || getAllClasses(data)[0] || '';
    const auto = computeFeesForClass(cls);
    return { name: '', admNo: '', class: cls, stream: '', dob: '', parent: '', phone: '', feesTotal: auto || 15000, feesPaid: 0, joined: new Date().getFullYear().toString() };
  }

  // Only class teachers can add students, and only to their class
  const canAdd = isPrincipal || isClassTeacher;
  const addableClasses = isPrincipal ? getAllClasses(data) : isClassTeacher ? [myClass] : [];

  function save() {
    if (!isPrincipal && isClassTeacher && form.class !== myClass) {
      alert(`You can only add students to your class: ${myClass}`);
      return;
    }
    // Auto-derive stream from class name (last word if multi-stream class)
    
    const stream = getStreamFromClass(form.class, data) || '';
    const ns = { id: Date.now(), ...form, stream, fees: { paid: Number(form.feesPaid), total: Number(form.feesTotal) }, cases: [] };
    setData(d => ({ ...d, students: [...d.students, ns] }));
    setShow(false); setForm(initForm());
  }

  function deleteStudent(id) {
    if (!isPrincipal) { alert('Only the principal can delete student records.'); return; }
    if (window.confirm('Delete this student?')) setData(d => ({ ...d, students: d.students.filter(s => s.id !== id) }));
  }

  function addCase(s) {
    if (!caseText.trim()) return;
    const entry = `${caseText} — ${new Date().toISOString().split('T')[0]}`;
    setData(d => ({ ...d, students: d.students.map(st => st.id === s.id ? { ...st, cases: [...st.cases, entry] } : st) }));
    setViewStudent(prev => ({ ...prev, cases: [...prev.cases, entry] }));
    setCaseText('');
  }

  const filtered = getVisibleStudents(search, filterClass);

  // Visible class filter options
  const allClasses = getAllClasses(data);
  const visibleClasses = isPrincipal ? allClasses
    : isClassTeacher ? [myClass]
    : (user.teacherSubjects || []).flatMap(s => s.classes).filter((v, i, a) => a.indexOf(v) === i);

  /* ── Student detail view ──────────────────────────── */
  if (viewStudent) {
    const s   = data.students.find(x => x.id === viewStudent.id) || viewStudent;
    const pct = Math.round(s.fees.paid / s.fees.total * 100);
    const exams = data.exams.filter(e => e.class === s.class);
    const payments = (data.feePayments || []).filter(p => p.studentId === s.id);
    const canSeeFees = isPrincipal || user.canSeeFees;

    // Subject teacher: only see their subjects in results
    const mySubjects = (user.teacherSubjects || []).map(x => x.subject);

    return (
      <div>
        <Btn variant="ghost" size="sm" onClick={() => setViewStudent(null)} style={{ marginBottom: 16 }}>
          <Icon name="back" size={14} /> Back to Students
        </Btn>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Avatar name={s.name} size={52} color="#4f8ef7" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>{s.admNo} · {s.class}</div>
              </div>
            </div>
            {[['Parent/Guardian', s.parent], ['Phone', s.phone], ['Date of Birth', s.dob], ['Year Joined', s.joined], ['Current Class', s.class]]
              .map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #2a3350', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>{l}</span>
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

          {canSeeFees ? (
            <Card>
              <SectionTitle icon="fees">Fee Account</SectionTitle>
              <div style={{ fontSize: 28, fontWeight: 700, color: pct >= 100 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444', marginBottom: 4 }}>
                KES {s.fees.paid.toLocaleString()}
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>of KES {s.fees.total.toLocaleString()} total</div>
              <ProgressBar pct={pct} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 10 }}>
                <span style={{ color: '#64748b' }}>Balance: KES {(s.fees.total - s.fees.paid).toLocaleString()}</span>
                <Tag color={pct >= 100 ? 'green' : pct > 50 ? 'amber' : 'red'}>{pct >= 100 ? 'Paid' : pct > 50 ? 'Partial' : 'Arrears'}</Tag>
              </div>
              {payments.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Payment History</div>
                  {payments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #2a3350' }}>
                      <span style={{ color: '#94a3b8' }}>{p.date}</span>
                      <span>{p.method}</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>KES {p.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
                Fee information is restricted to Finance Office and Principal only.
              </div>
            </Card>
          )}
        </div>

        {/* Cases — only class teacher and principal */}
        {(isPrincipal || isClassTeacher) && (
          <Card style={{ marginBottom: 16 }}>
            <SectionTitle icon="alert">Disciplinary Cases</SectionTitle>
            {s.cases.length === 0
              ? <p style={{ color: '#64748b', fontSize: 13 }}>No cases on record. ✓</p>
              : s.cases.map((c, i) => <Alert key={i} type="warning"><Icon name="alert" size={14} />{c}</Alert>)}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={caseText} onChange={e => setCaseText(e.target.value)} placeholder="Log a new case..." style={{ flex: 1 }} />
              <Btn size="sm" onClick={() => addCase(s)} disabled={!caseText.trim()}>Log</Btn>
            </div>
          </Card>
        )}

        {/* Academic performance */}
        <Card>
          <SectionTitle icon="exams">Academic Performance</SectionTitle>
          {exams.length === 0
            ? <p style={{ color: '#64748b', fontSize: 13 }}>No exam records yet.</p>
            : exams.map(ex => {
              const res  = ex.results[s.name];
              if (!res) return <p key={ex.id} style={{ color: '#64748b', fontSize: 13 }}>No results recorded for {ex.name}.</p>;

              // Filter subjects visible to this user
              const visibleSubs = Object.keys(res).filter(sub => {
                if (isPrincipal || isClassTeacher) return true;
                return mySubjects.includes(sub);
              });
              if (!visibleSubs.length) return null;

              const scores = visibleSubs.map(sub => {
                const cell = res[sub];
                return cell?.score ?? cell ?? 0;
              });
              const total = scores.reduce((a, b) => a + b, 0);
              const mean  = Math.round(total / scores.length);
              const g     = getGrade(mean);

              return (
                <div key={ex.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{ex.name}</span>
                    {(isPrincipal || isClassTeacher) && <span style={{ color: g.color, fontWeight: 700 }}>Mean: {g.label} ({mean})</span>}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={TS.table}>
                      <thead><tr>{[...visibleSubs, ...(isPrincipal || isClassTeacher ? ['Total', 'Grade'] : [])].map(h => <th key={h} style={TS.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        <tr>
                          {visibleSubs.map(sub => {
                            const cell = res[sub];
                            const score = cell?.score ?? cell ?? '—';
                            return <td key={sub} style={{ ...TS.td, textAlign: 'center' }}>{score}</td>;
                          })}
                          {(isPrincipal || isClassTeacher) && (
                            <><td style={{ ...TS.td, fontWeight: 700 }}>{total}</td><td style={TS.td}><GradeBadge score={mean} /></td></>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {(isPrincipal || isClassTeacher) && (
                    <div style={{ marginTop: 6, textAlign: 'right' }}>
                      <Btn size="sm" variant="ghost" onClick={() => printReportForm(s, ex, data)}>
                        <Icon name="print" size={12} /> Print Report
                      </Btn>
                    </div>
                  )}
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
        <Alert type="info">
          <Icon name="alert" size={14} />
          You are viewing students for your class: <strong>{myClass}</strong>. You can add students to this class only.
        </Alert>
      )}
      {!isPrincipal && !isClassTeacher && (
        <Alert type="info">
          <Icon name="alert" size={14} />
          Showing students from classes you teach. You can view but not add students.
        </Alert>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search name or adm no..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }} />
        {isPrincipal && (
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ width: 160 }}>
            <option value="">All Classes</option>
            {visibleClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div style={{ marginLeft: 'auto' }}>
          {canAdd && (
            <Btn onClick={() => setShow(true)}><Icon name="add" size={14} /> Add Student</Btn>
          )}
        </div>
      </div>

      <Card noPad>
        <div style={{ overflowX: 'auto' }}>
          <table style={TS.table}>
            <thead>
              <tr>{['Adm No', 'Name', 'Class', 'Parent/Guardian', ...(user.canSeeFees || isPrincipal ? ['Fees'] : []), 'Cases', ''].map(h => <th key={h} style={TS.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const pct = Math.round(s.fees.paid / s.fees.total * 100);
                return (
                  <tr key={s.id}>
                    <td style={TS.td}><Tag color="blue">{s.admNo}</Tag></td>
                    <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                    <td style={TS.td}>{s.class}</td>
                    <td style={{ ...TS.td, color: '#94a3b8' }}>{s.parent}</td>
                    {(user.canSeeFees || isPrincipal) && (
                      <td style={TS.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ProgressBar pct={pct} />
                          <span style={{ fontSize: 11, color: '#64748b' }}>{pct}%</span>
                        </div>
                      </td>
                    )}
                    <td style={TS.td}>
                      {s.cases.length > 0 ? <Tag color="red">{s.cases.length}</Tag> : <Tag color="green">Clear</Tag>}
                    </td>
                    <td style={TS.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn size="sm" variant="ghost" onClick={() => setViewStudent(s)}>
                          <Icon name="eye" size={13} />
                        </Btn>
                        {isPrincipal && (
                          <Btn size="sm" variant="danger" onClick={() => deleteStudent(s.id)}>
                            <Icon name="trash" size={13} />
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ ...TS.td, textAlign: 'center', color: '#64748b', padding: 28 }}>No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal show={show} onClose={() => { setShow(false); setForm(initForm()); }} title="Add New Student">
        <FormRow>
          <FormGroup label="Full Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Alice Muthoni" /></FormGroup>
          <FormGroup label="Admission Number"><input value={form.admNo} onChange={e => setForm({ ...form, admNo: e.target.value })} placeholder="e.g. ADM009" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Class">
            <select value={form.class} onChange={e => { const auto = computeFeesForClass(e.target.value); setForm({ ...form, class: e.target.value, feesTotal: auto || form.feesTotal }); }} disabled={isClassTeacher && !isPrincipal}>
              {addableClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Date of Birth"><input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Parent/Guardian Name"><input value={form.parent} onChange={e => setForm({ ...form, parent: e.target.value })} /></FormGroup>
          <FormGroup label="Parent Phone"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Total Fee (KES)"><input type="number" value={form.feesTotal} onChange={e => setForm({ ...form, feesTotal: e.target.value })} /></FormGroup>
          <FormGroup label="Amount Paid (KES)"><input type="number" value={form.feesPaid} onChange={e => setForm({ ...form, feesPaid: e.target.value })} /></FormGroup>
        </FormRow>
        <FormGroup label="Year Joined"><input value={form.joined} onChange={e => setForm({ ...form, joined: e.target.value })} /></FormGroup>
        {isClassTeacher && !isPrincipal && (
          <Alert type="info"><Icon name="alert" size={13} />This student will be added to your class: <strong>{myClass}</strong></Alert>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => { setShow(false); setForm(initForm()); }}>Cancel</Btn>
          <Btn onClick={save} disabled={!form.name || !form.admNo}>Add Student</Btn>
        </div>
      </Modal>
    </div>
  );
}

const TS = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:    { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #2a3350', background: '#1e2435' },
  td:    { padding: '10px 14px', borderBottom: '1px solid #2a3350', color: '#e2e8f0' },
};
