import React, { useState, useMemo } from 'react';
import { Card, Modal, Btn, Tag, FormGroup, FormRow, SectionTitle, Alert, Icon, Avatar } from './UI';

/* ═══════════════════════════════════════════════════════
   STUDENT STATUS MODULE
   Tabs: Roll Call | Permissions | Withdrawals | Alerts
═══════════════════════════════════════════════════════ */

const TODAY = new Date().toISOString().split('T')[0];
const CUR_YEAR = new Date().getFullYear();
const CUR_TERM = new Date().getMonth() < 4 ? 1 : new Date().getMonth() < 8 ? 2 : 3;

export default function StudentStatus({ data, setData, user }) {
  const isPrincipal    = user.role === 'principal';
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;
  const canAdmin       = isPrincipal || isClassTeacher;

  const [tab, setTab] = useState('rollcall');

  const tabs = [
    { id: 'rollcall',    label: '📋 Roll Call' },
    { id: 'permissions', label: '🚪 Permissions' },
    { id: 'withdrawals', label: '🚶 Withdrawals / Expelled' },
    isPrincipal && { id: 'alerts', label: '🔔 Alerts' },
  ].filter(Boolean);

  const TAB_S = (active) => ({
    padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500,
    background: active ? '#171b26' : 'transparent',
    color: active ? '#e2e8f0' : '#64748b',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, background: '#1e2435', padding: 4, borderRadius: 10, marginBottom: 18, width: 'fit-content', flexWrap: 'wrap' }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={TAB_S(tab === t.id)}>{t.label}</button>)}
      </div>

      {tab === 'rollcall'    && <RollCall     data={data} setData={setData} user={user} isPrincipal={isPrincipal} myClass={myClass} />}
      {tab === 'permissions' && <Permissions  data={data} setData={setData} user={user} isPrincipal={isPrincipal} myClass={myClass} />}
      {tab === 'withdrawals' && <Withdrawals  data={data} setData={setData} user={user} isPrincipal={isPrincipal} />}
      {tab === 'alerts'      && isPrincipal && <StatusAlerts data={data} setData={setData} />}
    </div>
  );
}

/* ── ROLL CALL ────────────────────────────────────────── */
function RollCall({ data, setData, user, isPrincipal, myClass }) {
  const [selClass, setSelClass] = useState(myClass || (data.classGroups?.[0]?.name || ''));
  const [selTerm,  setSelTerm]  = useState(String(CUR_TERM));
  const [selYear,  setSelYear]  = useState(String(CUR_YEAR));
  const [showTake, setShowTake] = useState(false);
  const [rollResult, setRollResult] = useState({});

  const allClasses = getAllClasses(data);
  const classStudents = (data.students || [])
    .filter(s => s.class === selClass && (!s.status || s.status === 'active'));

  // Find existing roll call for this class/term/year
  const rollCalls = data.rollCalls || [];
  const existingRoll = rollCalls.find(r =>
    r.class === selClass && r.term === Number(selTerm) && r.year === Number(selYear)
  );

  function startRollCall() {
    const init = {};
    classStudents.forEach(s => { init[s.id] = existingRoll?.results?.[s.id] ?? null; });
    setRollResult(init);
    setShowTake(true);
  }

  function saveRollCall() {
    const newRoll = {
      id:      existingRoll?.id || Date.now(),
      class:   selClass,
      term:    Number(selTerm),
      year:    Number(selYear),
      date:    TODAY,
      takenBy: user.name,
      results: rollResult, // { studentId: true/false/null }
    };
    const updated = existingRoll
      ? rollCalls.map(r => r.id === existingRoll.id ? newRoll : r)
      : [...rollCalls, newRoll];

    // Check for students who didn't return
    const absent = Object.entries(rollResult).filter(([, v]) => v === false).map(([id]) => Number(id));
    const absentStudents = classStudents.filter(s => absent.includes(s.id));

    // Create alerts for absent students
    const existingAlertIds = (data.statusAlerts || []).map(a => `${a.studentId}-${a.term}-${a.year}-absent`);
    const newAlerts = absentStudents
      .filter(s => !existingAlertIds.includes(`${s.id}-${selTerm}-${selYear}-absent`))
      .map(s => ({
        id:        Date.now() + s.id,
        type:      'absent_rollcall',
        studentId: s.id,
        studentName: s.name,
        class:     s.class,
        term:      Number(selTerm),
        year:      Number(selYear),
        message:   `${s.name} (${s.admNo}) did NOT return for Term ${selTerm} ${selYear} — ${s.class}`,
        date:      TODAY,
        resolved:  false,
      }));

    setData(d => ({
      ...d,
      rollCalls:    updated,
      statusAlerts: [...(d.statusAlerts || []), ...newAlerts],
    }));
    setShowTake(false);
    if (absentStudents.length > 0) {
      alert(`⚠ Roll call saved. ${absentStudents.length} student(s) did not return: ${absentStudents.map(s => s.name).join(', ')}`);
    } else {
      alert('✅ Roll call saved. All students returned!');
    }
  }

  const present = existingRoll ? Object.values(existingRoll.results).filter(v => v === true).length  : 0;
  const absent  = existingRoll ? Object.values(existingRoll.results).filter(v => v === false).length : 0;

  return (
    <div>
      <Alert type="info">
        <Icon name="alert" size={14} />
        At the beginning of each term, class teachers take a roll call to confirm which students have returned. Absent students automatically generate alerts for the principal.
      </Alert>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {isPrincipal && (
          <select value={selClass} onChange={e => setSelClass(e.target.value)} style={{ width: 180 }}>
            {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {!isPrincipal && <Tag color="blue">Your Class: {myClass}</Tag>}
        <select value={selTerm} onChange={e => setSelTerm(e.target.value)} style={{ width: 100 }}>
          {['1','2','3'].map(t => <option key={t} value={t}>Term {t}</option>)}
        </select>
        <input type="number" value={selYear} onChange={e => setSelYear(e.target.value)} style={{ width: 80 }} />
        <Btn onClick={startRollCall} disabled={classStudents.length === 0}>
          <Icon name="check" size={14} /> {existingRoll ? 'Update Roll Call' : 'Take Roll Call'}
        </Btn>
      </div>

      {existingRoll ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { l: 'Total Students', v: classStudents.length, c: '#4f8ef7' },
              { l: 'Present',        v: present,               c: '#10b981' },
              { l: 'Absent',         v: absent,                c: '#ef4444' },
              { l: 'Taken By',       v: existingRoll.takenBy,  c: '#f59e0b' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: v?.length > 10 ? 14 : 22, fontWeight: 700, color: c, marginBottom: 4 }}>{v}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{l}</div>
              </div>
            ))}
          </div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={TS.table}>
                <thead><tr>{['Adm No','Name','Class','Status'].map(h => <th key={h} style={TS.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {classStudents.map(s => {
                    const v = existingRoll.results[s.id];
                    return (
                      <tr key={s.id}>
                        <td style={TS.td}>{s.admNo}</td>
                        <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                        <td style={TS.td}>{s.class}</td>
                        <td style={TS.td}>
                          {v === true  && <Tag color="green">✓ Present</Tag>}
                          {v === false && <Tag color="red">✗ Absent</Tag>}
                          {v === null  && <Tag color="gray">Not recorded</Tag>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <Card style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          No roll call taken yet for {selClass} — Term {selTerm} {selYear}.
          <br /><br />
          <Btn onClick={startRollCall} disabled={classStudents.length === 0}>Take Roll Call Now</Btn>
        </Card>
      )}

      {/* Roll Call Modal */}
      <Modal show={showTake} onClose={() => setShowTake(false)} title={`Roll Call — ${selClass} — Term ${selTerm} ${selYear}`} wide>
        <Alert type="info">
          <Icon name="alert" size={14} />
          Mark each student as Present (returned for this term) or Absent (has not returned).
        </Alert>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <Btn size="sm" variant="success" onClick={() => {
            const all = {};
            classStudents.forEach(s => { all[s.id] = true; });
            setRollResult(all);
          }}>Mark All Present</Btn>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={TS.table}>
            <thead><tr>{['Adm No','Name','Class','Mark as'].map(h => <th key={h} style={TS.th}>{h}</th>)}</tr></thead>
            <tbody>
              {classStudents.map(s => (
                <tr key={s.id}>
                  <td style={TS.td}>{s.admNo}</td>
                  <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                  <td style={TS.td}>{s.class}</td>
                  <td style={{ ...TS.td, display: 'flex', gap: 8 }}>
                    <button onClick={() => setRollResult(r => ({ ...r, [s.id]: true }))} style={{
                      padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      background: rollResult[s.id] === true ? '#10b981' : '#1e2435',
                      color: rollResult[s.id] === true ? '#fff' : '#64748b',
                    }}>✓ Present</button>
                    <button onClick={() => setRollResult(r => ({ ...r, [s.id]: false }))} style={{
                      padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      background: rollResult[s.id] === false ? '#ef4444' : '#1e2435',
                      color: rollResult[s.id] === false ? '#fff' : '#64748b',
                    }}>✗ Absent</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn variant="ghost" onClick={() => setShowTake(false)}>Cancel</Btn>
          <Btn variant="success" onClick={saveRollCall}>Save Roll Call</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ── PERMISSIONS ──────────────────────────────────────── */
function Permissions({ data, setData, user, isPrincipal, myClass }) {
  const [showAdd, setShowAdd]  = useState(false);
  const [filterClass, setFilterClass] = useState(isPrincipal ? '' : myClass || '');
  const [filterStatus, setFilterStatus] = useState('all');
  const [form, setForm] = useState({
    studentId: '', reason: '', dateGiven: TODAY, dateReturn: '', approvedBy: user.name,
  });

  const permissions = (data.permissions || []).filter(p => {
    const student = (data.students || []).find(s => s.id === p.studentId);
    return (!filterClass || student?.class === filterClass) &&
           (filterStatus === 'all' ||
            (filterStatus === 'out' && !p.returned) ||
            (filterStatus === 'overdue' && !p.returned && p.dateReturn < TODAY) ||
            (filterStatus === 'returned' && p.returned));
  });

  // Auto-check overdue
  const overdue = (data.permissions || []).filter(p => !p.returned && p.dateReturn < TODAY);

  function grantPermission() {
    const student = (data.students || []).find(s => s.id === Number(form.studentId));
    if (!student || !form.reason || !form.dateReturn) return;
    const perm = {
      id:          Date.now(),
      studentId:   student.id,
      studentName: student.name,
      studentClass:student.class,
      reason:      form.reason,
      dateGiven:   form.dateGiven,
      dateReturn:  form.dateReturn,
      approvedBy:  form.approvedBy,
      returned:    false,
      returnDate:  null,
    };
    setData(d => ({ ...d, permissions: [...(d.permissions || []), perm] }));
    setShowAdd(false);
    setForm({ studentId: '', reason: '', dateGiven: TODAY, dateReturn: '', approvedBy: user.name });
  }

  function markReturned(id) {
    setData(d => ({
      ...d,
      permissions: (d.permissions || []).map(p =>
        p.id === id ? { ...p, returned: true, returnDate: TODAY } : p
      ),
      statusAlerts: (d.statusAlerts || []).filter(a => !(a.type === 'overdue_permission' && a.permissionId === id)),
    }));
  }

  const classStudents = (data.students || [])
    .filter(s => (!filterClass || s.class === filterClass) && (!s.status || s.status === 'active'));

  const allClasses = getAllClasses(data);

  return (
    <div>
      {overdue.length > 0 && (
        <Alert type="warning">
          <Icon name="alert" size={16} />
          <div>
            <strong>⚠ {overdue.length} student(s) have not returned by their due date: </strong>
            {overdue.map(p => p.studentName).join(', ')}
          </div>
        </Alert>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {isPrincipal && (
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ width: 160 }}>
            <option value="">All Classes</option>
            {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 160 }}>
          <option value="all">All Permissions</option>
          <option value="out">Currently Out</option>
          <option value="overdue">Overdue (not returned)</option>
          <option value="returned">Returned</option>
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <Btn onClick={() => setShowAdd(true)}><Icon name="add" size={14} /> Grant Permission</Btn>
        </div>
      </div>

      {permissions.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No permission records found.</Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={TS.table}>
              <thead><tr>{['Student','Class','Reason','Date Given','Due Return','Approved By','Status','Action'].map(h => <th key={h} style={TS.th}>{h}</th>)}</tr></thead>
              <tbody>
                {permissions.map(p => {
                  const isOverdue = !p.returned && p.dateReturn < TODAY;
                  return (
                    <tr key={p.id}>
                      <td style={{ ...TS.td, fontWeight: 500 }}>{p.studentName}</td>
                      <td style={TS.td}>{p.studentClass}</td>
                      <td style={{ ...TS.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.reason}</td>
                      <td style={TS.td}>{p.dateGiven}</td>
                      <td style={{ ...TS.td, color: isOverdue ? '#ef4444' : '#e2e8f0', fontWeight: isOverdue ? 700 : 400 }}>
                        {p.dateReturn} {isOverdue && '⚠'}
                      </td>
                      <td style={{ ...TS.td, color: '#94a3b8' }}>{p.approvedBy}</td>
                      <td style={TS.td}>
                        {p.returned
                          ? <Tag color="green">✓ Returned {p.returnDate}</Tag>
                          : isOverdue
                          ? <Tag color="red">OVERDUE</Tag>
                          : <Tag color="amber">Out</Tag>}
                      </td>
                      <td style={TS.td}>
                        {!p.returned && (
                          <Btn size="sm" variant="success" onClick={() => markReturned(p.id)}>
                            ✓ Mark Returned
                          </Btn>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal show={showAdd} onClose={() => setShowAdd(false)} title="Grant Student Permission to Go Home">
        <Alert type="info">
          <Icon name="alert" size={14} />
          The system will track whether the student returns by the stated date and alert if they do not.
        </Alert>
        <FormGroup label="Select Student *">
          <select value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
            <option value="">Choose student...</option>
            {(isPrincipal ? (data.students||[]).filter(s=>!s.status||s.status==='active') : classStudents).map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.admNo}) — {s.class}</option>
            ))}
          </select>
        </FormGroup>
        <FormGroup label="Reason for Permission *">
          <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
            rows={3} placeholder="e.g. Medical appointment, family emergency, funeral..." />
        </FormGroup>
        <FormRow>
          <FormGroup label="Date Permission Given *">
            <input type="date" value={form.dateGiven} onChange={e => setForm({ ...form, dateGiven: e.target.value })} />
          </FormGroup>
          <FormGroup label="Expected Return Date *">
            <input type="date" value={form.dateReturn} onChange={e => setForm({ ...form, dateReturn: e.target.value })} min={TODAY} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Approved By">
          <input value={form.approvedBy} onChange={e => setForm({ ...form, approvedBy: e.target.value })} />
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          <Btn onClick={grantPermission} disabled={!form.studentId || !form.reason || !form.dateReturn}>
            Grant Permission
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ── WITHDRAWALS / EXPELLED ───────────────────────────── */
function Withdrawals({ data, setData, user, isPrincipal }) {
  const [showRemove, setShowRemove] = useState(false);
  const [removeForm, setRemoveForm] = useState({
    studentId: '', type: 'withdrawn', reason: '', date: TODAY, feeCleared: false, remarks: '',
  });
  const [tab, setTab] = useState('active');

  const activeStudents   = (data.students || []).filter(s => !s.status || s.status === 'active');
  const removedStudents  = (data.students || []).filter(s => s.status && s.status !== 'active');

  // Students who left without clearing fees
  const leftWithBalance = removedStudents.filter(s => {
    const payments = (data.feePayments || []).filter(p => p.studentId === s.id);
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    return !s.feeCleared && paid === 0;
  });

  function removeStudent() {
    const { studentId, type, reason, date, feeCleared, remarks } = removeForm;
    if (!studentId || !reason) return;
    setData(d => ({
      ...d,
      students: d.students.map(s =>
        s.id === Number(studentId)
          ? { ...s, status: type, withdrawalReason: reason, withdrawalDate: date, feeCleared, withdrawalRemarks: remarks }
          : s
      ),
      statusAlerts: [
        ...(d.statusAlerts || []),
        {
          id: Date.now(), type: 'withdrawal',
          studentId: Number(studentId),
          studentName: d.students.find(s=>s.id===Number(studentId))?.name,
          message: `${d.students.find(s=>s.id===Number(studentId))?.name} has been ${type} from ${d.students.find(s=>s.id===Number(studentId))?.class} on ${date}. Reason: ${reason}`,
          date: TODAY, resolved: false,
        },
      ],
    }));
    setShowRemove(false);
    setRemoveForm({ studentId: '', type: 'withdrawn', reason: '', date: TODAY, feeCleared: false, remarks: '' });
  }

  function reinstateStudent(id) {
    if (!window.confirm('Reinstate this student as active?')) return;
    setData(d => ({
      ...d,
      students: d.students.map(s =>
        s.id === id ? { ...s, status: 'active', withdrawalReason: undefined, withdrawalDate: undefined } : s
      ),
    }));
  }

  const TAB_S = (active) => ({
    padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: active ? '#171b26' : 'transparent', color: active ? '#e2e8f0' : '#64748b',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, background: '#1e2435', padding: 4, borderRadius: 10, marginBottom: 14, width: 'fit-content' }}>
        <button style={TAB_S(tab==='active')} onClick={() => setTab('active')}>Active Students ({activeStudents.length})</button>
        <button style={TAB_S(tab==='removed')} onClick={() => setTab('removed')}>
          Withdrawn / Expelled ({removedStudents.length})
        </button>
      </div>

      {leftWithBalance.length > 0 && tab === 'removed' && (
        <Alert type="warning">
          <Icon name="alert" size={16} />
          <strong>{leftWithBalance.length} student(s) left without clearing fees.</strong>{' '}
          {leftWithBalance.map(s => s.name).join(', ')}
        </Alert>
      )}

      {tab === 'active' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            {isPrincipal && (
              <Btn variant="danger" onClick={() => setShowRemove(true)}>
                <Icon name="trash" size={14} /> Remove Student from School
              </Btn>
            )}
          </div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={TS.table}>
                <thead><tr>{['Adm No','Name','Class','Year Joined','Status'].map(h=><th key={h} style={TS.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {activeStudents.map(s => (
                    <tr key={s.id}>
                      <td style={TS.td}><Tag color="blue">{s.admNo}</Tag></td>
                      <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                      <td style={TS.td}>{s.class}</td>
                      <td style={TS.td}>{s.joined}</td>
                      <td style={TS.td}><Tag color="green">Active</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'removed' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {removedStudents.length === 0
            ? <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No withdrawn or expelled students.</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={TS.table}>
                  <thead><tr>{['Adm No','Name','Last Class','Type','Date','Reason','Fee Cleared','Action'].map(h=><th key={h} style={TS.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {removedStudents.map(s => (
                      <tr key={s.id}>
                        <td style={TS.td}>{s.admNo}</td>
                        <td style={{ ...TS.td, fontWeight: 500 }}>{s.name}</td>
                        <td style={TS.td}>{s.class}</td>
                        <td style={TS.td}>
                          <Tag color={s.status === 'expelled' ? 'red' : 'amber'}>
                            {s.status === 'expelled' ? 'Expelled' : 'Withdrawn'}
                          </Tag>
                        </td>
                        <td style={TS.td}>{s.withdrawalDate || '—'}</td>
                        <td style={{ ...TS.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.withdrawalReason || '—'}</td>
                        <td style={TS.td}>
                          <Tag color={s.feeCleared ? 'green' : 'red'}>
                            {s.feeCleared ? '✓ Cleared' : '✗ Pending'}
                          </Tag>
                        </td>
                        <td style={TS.td}>
                          {isPrincipal && (
                            <Btn size="sm" variant="ghost" onClick={() => reinstateStudent(s.id)}>Reinstate</Btn>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Card>
      )}

      {/* Remove Student Modal */}
      <Modal show={showRemove} onClose={() => setShowRemove(false)} title="Remove Student from School">
        <Alert type="danger">
          <Icon name="alert" size={14} />
          This action changes the student's status. Their full record is preserved permanently — academic history, fee records, everything. They will be removed from active class lists but their data is never deleted.
        </Alert>
        <FormGroup label="Select Student *">
          <select value={removeForm.studentId} onChange={e => setRemoveForm({ ...removeForm, studentId: e.target.value })}>
            <option value="">Choose student...</option>
            {activeStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.admNo}) — {s.class}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Type of Removal *">
          <select value={removeForm.type} onChange={e => setRemoveForm({ ...removeForm, type: e.target.value })}>
            <option value="withdrawn">Voluntarily Withdrawn (transferred to another school)</option>
            <option value="expelled">Expelled (disciplinary)</option>
            <option value="completed">Completed School</option>
            <option value="unknown">Left Without Notice</option>
          </select>
        </FormGroup>
        <FormGroup label="Reason *">
          <textarea value={removeForm.reason} onChange={e => setRemoveForm({ ...removeForm, reason: e.target.value })} rows={3} placeholder="State the reason clearly..." />
        </FormGroup>
        <FormRow>
          <FormGroup label="Date of Removal">
            <input type="date" value={removeForm.date} onChange={e => setRemoveForm({ ...removeForm, date: e.target.value })} />
          </FormGroup>
          <FormGroup label="Additional Remarks">
            <input value={removeForm.remarks} onChange={e => setRemoveForm({ ...removeForm, remarks: e.target.value })} placeholder="Optional notes" />
          </FormGroup>
        </FormRow>
        <FormGroup>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={removeForm.feeCleared} onChange={e => setRemoveForm({ ...removeForm, feeCleared: e.target.checked })} />
            Fees have been cleared before leaving
          </label>
        </FormGroup>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowRemove(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={removeStudent} disabled={!removeForm.studentId || !removeForm.reason}>
            Remove from School
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ── ALERTS ───────────────────────────────────────────── */
function StatusAlerts({ data, setData }) {
  const alerts = (data.statusAlerts || []).filter(a => !a.resolved);
  const resolved = (data.statusAlerts || []).filter(a => a.resolved);

  // Auto-generate overdue permission alerts
  const overduePerms = (data.permissions || []).filter(p => !p.returned && p.dateReturn < TODAY);

  function resolve(id) {
    setData(d => ({
      ...d,
      statusAlerts: d.statusAlerts.map(a => a.id === id ? { ...a, resolved: true, resolvedDate: TODAY } : a),
    }));
  }

  const typeColors = {
    absent_rollcall:    'red',
    withdrawal:         'amber',
    overdue_permission: 'red',
  };
  const typeLabels = {
    absent_rollcall:    'Did Not Return',
    withdrawal:         'Withdrawal',
    overdue_permission: 'Overdue Permission',
  };

  return (
    <div>
      {overduePerms.length > 0 && (
        <Alert type="warning">
          <Icon name="alert" size={16} />
          <strong>{overduePerms.length} student(s) with expired permissions have not been marked as returned:</strong>{' '}
          {overduePerms.map(p => `${p.studentName} (due ${p.dateReturn})`).join(', ')}
        </Alert>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>{alerts.length} active alert(s)</div>
      </div>

      {alerts.length === 0 && overduePerms.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40, color: '#10b981' }}>
          ✅ No active alerts. Everything looks good!
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map(a => (
            <div key={a.id} style={{
              background: '#171b26', border: `1px solid ${a.type==='absence'||a.type==='absent_rollcall'||a.type==='overdue_permission' ? '#ef444440' : '#f59e0b40'}`,
              borderLeft: `4px solid ${a.type==='withdrawal' ? '#f59e0b' : '#ef4444'}`,
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <Tag color={typeColors[a.type] || 'red'}>{typeLabels[a.type] || a.type}</Tag>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{a.date}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>{a.message}</div>
                  {a.studentClass && <div style={{ fontSize: 12, color: '#94a3b8' }}>Class: {a.studentClass}</div>}
                </div>
                <Btn size="sm" variant="success" onClick={() => resolve(a.id)}>✓ Resolve</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Resolved Alerts ({resolved.length})
          </div>
          {resolved.slice(0, 5).map(a => (
            <div key={a.id} style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 8, padding: '10px 14px', marginBottom: 6, opacity: 0.6 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.message}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Resolved: {a.resolvedDate || '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */
function getAllClasses(data) {
  const list = [];
  (data.classGroups || []).forEach(g => {
    if (!g.streams || g.streams.length === 0) list.push(g.name);
    else g.streams.forEach(s => list.push(`${g.name} ${s}`));
  });
  return list;
}

const TS = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:    { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #2a3350', background: '#1e2435', whiteSpace: 'nowrap' },
  td:    { padding: '10px 12px', borderBottom: '1px solid #2a3350', color: '#e2e8f0' },
};
