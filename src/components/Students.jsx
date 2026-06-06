import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, Alert, ProgressBar, Avatar, GradeBadge, Icon } from './UI';
import { getGrade, getAllClasses, getScore, getStreamFromClass, generateSLC, generateAdmNo, buildStudentName } from '../data/initialData';
import { printLeavingCert, printReportForm, printStudentIntakeForm } from '../utils/print';

export default function Students({ data, setData, user, isUnlocked = true }) {
  const isPrincipal    = user.role === 'principal';
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;

  const admMode = data.admissionSetting || 'manual';
  // manual = Type A: required, admin types
  // auto   = Type B: system assigns, field hidden
  // mixed  = Type C: optional, system fills blank with hidden internalId

  function getVisibleStudents(search, filterClass) {
    let students = data.students;
    if (!isPrincipal) {
      if (isClassTeacher) students = students.filter(s => s.class === myClass);
      else {
        const myClasses = (user.teacherSubjects || []).flatMap(s => s.classes);
        students = students.filter(s => myClasses.includes(s.class));
      }
    }
    if (filterClass) students = students.filter(s => s.class === filterClass);
    if (search) students = students.filter(s =>
      (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.admNo || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.slc   || '').includes(search)
    );
    return students;
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

  const canAdd         = isPrincipal || isClassTeacher;
  const addableClasses = isPrincipal ? getAllClasses(data) : isClassTeacher ? [myClass] : [];

  function save() {
    if (!form.firstName.trim() && !form.lastName.trim()) {
      alert('Please enter at least a first name or last name.');
      return;
    }
    if (!isPrincipal && isClassTeacher && form.class !== myClass) {
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
    }
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
  const visibleClasses = isPrincipal ? allClasses
    : isClassTeacher ? [myClass]
    : (user.teacherSubjects || []).flatMap(s => s.classes).filter((v, i, a) => a.indexOf(v) === i);

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
                <div style={{ color: '#64748b', fontSize: 12 }}>
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
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>
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

          {canSeeFees_ ? (
            <Card>
              <SectionTitle icon="fees">Fee Account</SectionTitle>
              {!s.fees?.total ? (
                <div style={{ color: '#64748b', fontSize: 13 }}>No fee record set. Go to Fees module to assign.</div>
              ) : (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700, color: pct >= 100 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444', marginBottom: 4 }}>
                    KES {s.fees.paid.toLocaleString()}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>of KES {s.fees.total.toLocaleString()} total</div>
                  <ProgressBar pct={pct} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 10 }}>
                    <span style={{ color: '#64748b' }}>Balance: KES {(s.fees.total - s.fees.paid).toLocaleString()}</span>
                    <Tag color={pct >= 100 ? 'green' : pct > 50 ? 'amber' : 'red'}>
                      {pct >= 100 ? 'Paid' : pct > 50 ? 'Partial' : 'Arrears'}
                    </Tag>
                  </div>
                </>
              )}
            </Card>
          ) : (
            <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
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
              ? <p style={{ color: '#64748b', fontSize: 13 }}>No cases on record. ✓</p>
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
            ? <p style={{ color: '#64748b', fontSize: 13 }}>No exam records yet.</p>
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
        {isPrincipal && (
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ width: 160 }}>
            <option value="">All Classes</option>
            {visibleClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {isPrincipal && (
            <Btn variant="ghost" onClick={() => printStudentIntakeForm(data)}>
              <Icon name="print" size={14} /> Intake Form
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
                const pct = s.fees?.total > 0 ? Math.round(s.fees.paid/s.fees.total*100) : 0;
                return (
                  <tr key={s.id}>
                    <td style={TS.td}>
                      {s.admNo ? <Tag color="blue">{s.admNo}</Tag> : <span style={{color:'#64748b',fontSize:11}}>—</span>}
                    </td>
                    <td style={{...TS.td,fontWeight:500}}>{s.name}</td>
                    <td style={TS.td}>{s.class}</td>
                    <td style={TS.td}>
                      <span style={{fontFamily:'monospace',fontSize:12,color:'#10b981',fontWeight:600}}>{s.slc||'—'}</span>
                    </td>
                    {(user.canSeeFees||isPrincipal)&&(
                      <td style={TS.td}>
                        {s.fees?.total>0
                          ?<div style={{display:'flex',alignItems:'center',gap:8}}><ProgressBar pct={pct}/><span style={{fontSize:11,color:'#64748b'}}>{pct}%</span></div>
                          :<span style={{fontSize:11,color:'#64748b'}}>Not set</span>}
                      </td>
                    )}
                    <td style={TS.td}>{s.cases?.length>0?<Tag color="red">{s.cases.length}</Tag>:<Tag color="green">Clear</Tag>}</td>
                    <td style={TS.td}>
                      <div style={{display:'flex',gap:6}}>
                        <Btn size="sm" variant="ghost" onClick={()=>setViewStudent(s)}><Icon name="eye" size={13}/></Btn>
                        {isPrincipal&&<Btn size="sm" variant="danger" onClick={()=>deleteStudent(s.id)}><Icon name="trash" size={13}/></Btn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&(
                <tr><td colSpan={8} style={{...TS.td,textAlign:'center',color:'#64748b',padding:28}}>No students found.</td></tr>
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
        <div style={{fontSize:11,color:'#64748b',marginBottom:14,padding:'6px 10px',background:'#f0f9ff',borderRadius:6}}>
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
            <select value={form.class} onChange={e=>setForm({...form,class:e.target.value})} disabled={isClassTeacher&&!isPrincipal}>
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
    </div>
  );
}

const TS = {
  table: { width:'100%',borderCollapse:'collapse',fontSize:13 },
  th:    { textAlign:'left',padding:'10px 14px',fontSize:11,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.5px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc' },
  td:    { padding:'10px 14px',borderBottom:'1px solid #f1f5f9',color:'#1e293b' },
};
